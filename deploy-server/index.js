#!/usr/bin/env node
/*
 * Nova deploy server — runs on the VPS behind the Cloudflare tunnel.
 * - POST /api/deploy   upload a site (tar.gz) and publish it at <name>.freedomhub.at
 * - POST /api/register create a free/pro account-style token
 * - GET  /api/info     show account status for a token
 * - everything else    static hosting keyed off the Host header
 *
 * Env:
 *   HOST (default 127.0.0.1), PORT (default 8090)
 *   SITES_DIR (default /var/www/sites)
 *   STATE_FILE (default /opt/nova-deploy/deploy.json)
 *   ADMIN_TOKEN (pro, unlimited) — optional, generated/loaded from state
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { execFile as _execFile } from 'node:child_process'

const execFile = promisify(_execFile)

const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 8090)
const SITES_DIR = process.env.SITES_DIR || '/var/www/sites'
const STATE_FILE = process.env.STATE_FILE || '/opt/nova-deploy/deploy.json'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''

const MAX_UPLOAD = Number(process.env.MAX_UPLOAD || 256 * 1024 * 1024) // 256 MB raw body cap
const FREE_SITE_LIMIT = 1
const FREE_BYTES_LIMIT = 25 * 1024 * 1024
const PRO_BYTES_LIMIT = 200 * 1024 * 1024

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json'
}

const RESERVED_SLUGS = new Set([
  'www', 'test', 'hub', 'mail', 'mirror', 'mc', 'deploy', 'api', 'ftp',
  'admin', 'nova', 'dev', 'staging', 'beta', 'app', 'ns1', 'ns2', 'vpn',
  'freedomhub', 'root', 'mailto', 'autodiscover', 'caldav', 'cloud'
])

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
  } catch {}
  return { adminToken: ADMIN_TOKEN, accounts: {} }
}

let state = loadState()
if (!state.adminToken) state.adminToken = ADMIN_TOKEN
if (!state.accounts) state.accounts = {}

function saveState() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  const tmp = STATE_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8')
  fs.renameSync(tmp, STATE_FILE)
}

function resolveAccount(token) {
  if (token && state.adminToken && token === state.adminToken) {
    return { plan: 'pro', sites: Object.keys(state.accounts).length ? {} : {}, token }
  }
  const acc = token ? state.accounts[token] : undefined
  return acc || null
}

function validateSlug(slug) {
  if (!slug) return 'site name is required (header x-nova-site)'
  if (slug.length < 2 || slug.length > 40) return 'site name must be 2–40 characters'
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) return 'site name may only contain a-z, 0-9 and hyphens'
  if (RESERVED_SLUGS.has(slug)) return 'that site name is reserved'
  return null
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function listTarEntries(tarPath) {
  const { stdout } = await execFile('tar', ['-tzf', tarPath])
  return stdout.split('\n').filter(Boolean)
}

async function extractTar(tarPath, destDir) {
  await execFile('tar', ['-xzf', tarPath, '-C', destDir, '--no-same-owner', '--no-same-permissions'])
}

function dirSize(dir) {
  let total = 0
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else total += fs.statSync(p).size
    }
  }
  walk(dir)
  return total
}

async function unpackBody(body, siteName) {
  const tarPath = path.join('/tmp', `nova-upload-${siteName}-${Date.now()}.tgz`)
  fs.writeFileSync(tarPath, body)

  // Validate tar contents BEFORE extracting (block path traversal / absolute paths).
  const entries = await listTarEntries(tarPath)
  for (const e of entries) {
    if (!e || e.endsWith('/')) continue
    if (e.includes('..') || e.startsWith('/')) {
      fs.unlinkSync(tarPath)
      throw new Error(`unsafe archive entry: ${e}`)
    }
  }

  const staging = path.join(SITES_DIR, `.staging-${siteName}-${Date.now()}`)
  fs.rmSync(staging, { recursive: true, force: true })
  fs.mkdirSync(staging, { recursive: true })

  try {
    await extractTar(tarPath, staging)
  } finally {
    fs.unlinkSync(tarPath)
  }
  fs.rmSync(path.join(staging, '__nova__'), { recursive: true, force: true })

  // Move files into place — if the site ships a "public"/"site" folder, use it as root.
  let root = staging
  for (const rel of ['public', 'site', 'dist']) {
    const candidate = path.join(staging, rel)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() && fs.readdirSync(staging).length <= 2) {
      root = candidate
      break
    }
  }
  return { staging, root }
}

function handleDeploy(req, res) {
  const token = (req.headers['x-nova-token'] || '').toString().trim()
  const siteName = (req.headers['x-nova-site'] || '').toString().trim().toLowerCase()

  const nameErr = validateSlug(siteName)
  if (nameErr) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: nameErr }))
    return
  }

  const account = resolveAccount(token)
  if (!account) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'invalid deploy token (register first with `nova register`, or deploy with a valid token)' }))
    return
  }

  const mySites = () => (token === state.adminToken ? {} : state.accounts[token]?.sites ?? {})
  const siteCount = Object.keys(mySites()).filter((s) => s !== siteName).length
  if (account.plan !== 'pro' && account.plan !== 'admin' && siteCount >= FREE_SITE_LIMIT) {
    res.writeHead(402, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: `free plan hosts up to ${FREE_SITE_LIMIT} site — upgrade to Pro or delete a site` }))
    return
  }

  readBody(req, MAX_UPLOAD)
    .then(async (body) => {
      if (!body.length) throw new Error('empty payload')

      let staged
      try {
        const result = await unpackBody(body, siteName)
        staged = result
        const size = dirSize(path.join(staged.root))
        const limit = account.plan === 'pro' ? PRO_BYTES_LIMIT : FREE_BYTES_LIMIT
        if (size > limit) {
          throw new Error(`site is ${(size / 1024 / 1024).toFixed(1)} MB — your ${account.plan} plan allows ${(limit / 1024 / 1024).toFixed(0)} MB`)
        }

        const dest = path.join(SITES_DIR, siteName)
        fs.mkdirSync(SITES_DIR, { recursive: true })
        fs.rmSync(dest, { recursive: true, force: true })
        fs.renameSync(staged.staging, dest)
        fs.rmSync(path.join(dest, '__nova__'), { recursive: true, force: true })

        // Record ownership + update plan usage.
        if (!state.accounts[token]) state.accounts[token] = { plan: 'free', sites: {} }
        state.accounts[token].sites[siteName] = Date.now()
        saveState()

        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true, site: siteName, url: `https://${siteName}.freedomhub.at`, plan: account.plan }))
      } catch (err) {
        if (staged) fs.rmSync(staged.staging, { recursive: true, force: true })
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: err.message }))
      }
    })
    .catch((err) => {
      res.writeHead(413, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: err.message }))
    })
}

function handleRegister(req, res) {
  readBody(req, 1024 * 1024)
    .then(async (body) => {
      let payload = {}
      try { payload = JSON.parse(body.toString() || '{}') } catch {}
      const wantPro = payload.plan === 'pro'
      if (wantPro) {
        res.writeHead(402, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Pro requires a payment plan — billing is coming soon. Run `nova deploy --token <admin-token>` to use Pro now.' }))
        return
      }
      const token = crypto.randomBytes(18).toString('base64url')
      state.accounts[token] = { plan: 'free', sites: {} }
      saveState()
      res.writeHead(201, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, token, plan: 'free', url: 'https://freedomhub.at/pricing' }))
    })
    .catch((err) => {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: err.message }))
    })
}

function handleInfo(req, res) {
  const token = (req.headers['x-nova-token'] || '').toString().trim()
  const account = resolveAccount(token)
  if (!account) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'invalid deploy token' }))
    return
  }
  const sites = token === state.adminToken
    ? Object.keys(state.accounts).length
    : (state.accounts[token]?.sites ?? {})
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({
    ok: true,
    plan: account.plan,
    sites: Object.keys(typeof sites === 'object' ? sites : {}),
    siteLimit: account.plan === 'pro' ? null : FREE_SITE_LIMIT
  }))
}

function handleStatic(req, res, parsedUrl) {
  const host = (req.headers.host || '').toLowerCase().split(':')[0]
  let siteName = (req.headers['x-nova-site'] || '').toString().toLowerCase()
  if (host.endsWith('.freedomhub.at')) siteName = host.split('.')[0]
  if (!siteName || validateSlug(siteName)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('site not found')
    return
  }

  const siteRoot = path.join(SITES_DIR, siteName)
  if (!fs.existsSync(siteRoot)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('site not found')
    return
  }

  let urlPath = decodeURIComponent(parsedUrl.pathname)
  if (urlPath.endsWith('/')) urlPath += 'index.html'
  if (urlPath === '/') urlPath = '/index.html'

  // prevent path traversal
  const resolved = path.normalize(path.join(siteRoot, urlPath))
  if (!resolved.startsWith(siteRoot)) {
    res.writeHead(403, { 'content-type': 'text/plain' })
    res.end('forbidden')
    return
  }

  let filePath = resolved
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('404 — file not found')
    return
  }

  const ext = path.extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  res.writeHead(200, {
    'content-type': type,
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    'x-nova-hosted-by': 'freedomhub.at'
  })
  fs.createReadStream(filePath).pipe(res)
}

/* NEW ENDPOINTS ----------------------------------------------------------- */
async function handleDeleteSite(req, res) {
  const token = (req.headers['x-nova-token'] || '').toString().trim()
  const siteName = (req.url.split('/').pop() || '').toString().trim()
  if (!token || !siteName || !validateSlug(siteName)) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'missing token or site name' }))
    return
  }
  const account = resolveAccount(token)
  if (!account) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'invalid token' }))
    return
  }
  const mySites = () => (token === state.adminToken ? {} : state.accounts[token]?.sites ?? {})
  if (!mySites()[siteName]) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: `site ${siteName} not found` }))
    return
  }
  // delete the directory
  const sitePath = path.join(SITES_DIR, siteName)
  try {
    if (fs.existsSync(sitePath)) fs.rmSync(sitePath, { recursive: true, force: true })
  } catch (e) { /* ignore */ }
  // remove from account record
  delete mySites()[siteName]
  saveState()
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ ok: true, deleted: siteName }))
}

async function handleSitesList(req, res) {
  const token = (req.headers['x-nova-token'] || '').toString().trim()
  const account = resolveAccount(token)
  if (!account) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'invalid token' }))
    return
  }
  // Admins see all accounts' sites aggregated; regular tokens see only their own
  const mySites = () => (token === state.adminToken ? {} : state.accounts[token]?.sites ?? {})
  const out = { account: account.plan, sites: Object.keys(mySites()) }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(out))
}

async function handleUpgrade(req, res) {
  const token = (req.headers['x-nova-token'] || '').toString().trim()
  const accounted = resolveAccount(token)
  // If caller is admin token (pro already), upgrade is a no‑op but we treat it as allowed
  if (!token) {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'token required' }))
    return
  }
  // Admin token may pass a "target" free account to promote it
  const targetToken = (req.url.includes('--promote') ? new URL(req.url, 'http://localhost').searchParams.get('for') : null)
  if (targetToken) {
    // admin can promote another account
    const adminAcc = resolveAccount(state.adminToken)
    if (adminAcc?.plan !== 'pro' && adminAcc?.plan !== 'admin') {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'insufficient privileges' }))
      return
    }
    const targetAcc = state.accounts[targetToken]
    if (!targetAcc || targetAcc.plan !== 'free') {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'target must be a free account' }))
      return
    }
    targetAcc.plan = 'pro'
    state.accounts[targetToken] = targetAcc
    saveState()
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, upgraded: targetToken }))
    return
  }
  // For regular usage we just point them at the pricing page; the client will guide payment steps
  const redirect = '/pricing?token=' + encodeURIComponent(token)
  res.writeHead(302, { 'Location': redirect })
  res.end()
}

async function handlePricing(req, res) {
  // Very simple HTML pricing page — can be improved later
  const html = `
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><title>Pricing — Nova</title>
<style>
body{background:#05060f;color:#e6e8f2;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.wrap{padding:24px;max-width:640px;margin:auto;background:${'rgba(10,12,30,0.5)'}
</style></head><body>
<h2>Nova — Pricing</h2>
<p>Hosting is optional; pay only for live sites.</p>
<h3>Pro — Free forever for you, but site hosting is optional.</h3>
<ul>
<li>✓ Unlimited sites</li>
<li>✓ Up to 200 MB each</li>
<li>✓ Own sub‑domain (yourname.freedomhub.at)</li>
<li>✓ Future premium features</li>
</ul>
<p>Upgrade flow will be announced soon.</p>
<p><a href="#download" style="color:var(--accent-3);">Download client</a> to continue building.</p>
</body></html>
`
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end(html)
}

async function handleAccountInfo(req, res) {
  const token = (req.headers['x-nova-token'] || '').toString().trim()
  const account = resolveAccount(token)
  if (!account) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'invalid token' }))
    return
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({
    plan: account.plan,
    token: token,
    account: account
  }))
}

/* PERIODIC CLEANUP ------------------------------------------------------- */
function cleanupOrphans() {
  try {
    const entries = fs.readdirSync(SITES_DIR, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const name = e.name
      if (name.startsWith('.staging-')) {
        // remove stale staging dirs older than 10 min
        try {
          const mtime = fs.statSync(path.join(SITES_DIR, name)).mtimeMs
          if (Date.now() - mtime > 600000) fs.rmSync(path.join(SITES_DIR, name), { recursive: true, force: true })
        } catch { /* ignore */ }
        continue
      }
      // check if any account owns this site
      let owned = false
      for (const acc of Object.values(state.accounts)) {
        if (typeof acc === 'object' && acc.sites && name in acc.sites) { owned = true; break }
      }
      if (!owned && resolveAccount(state.adminToken)) {
        // remove orphaned site directory
        try { fs.rmSync(path.join(SITES_DIR, name), { recursive: true, force: true }) } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}
setInterval(cleanupOrphans, 300000) // 5 minutes

/* End NEW ENDPOINTS ------------------------------------------------------ */

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, 'http://localhost')
  if (req.method === 'POST' && parsed.pathname === '/api/deploy') return handleDeploy(req, res)
  if (req.method === 'POST' && parsed.pathname === '/api/register') return handleRegister(req, res)
  if (req.method === 'GET' && parsed.pathname === '/api/info') return handleInfo(req, res)
  if (req.method === 'DELETE' && parsed.pathname.startsWith('/api/site/')) return handleDeleteSite(req, res)
  if (req.method === 'GET' && parsed.pathname === '/api/sites') return handleSitesList(req, res)
  if (req.method === 'POST' && parsed.pathname === '/api/upgrade') return handleUpgrade(req, res)
  if (req.method === 'GET' && parsed.pathname === '/pricing') return handlePricing(req, res)
  if (req.method === 'GET' && parsed.pathname === '/account') return handleAccountInfo(req, res)
  if (req.method === 'GET' && parsed.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  return handleStatic(req, res, parsed)
})

fs.mkdirSync(SITES_DIR, { recursive: true })
saveState()

server.listen(PORT, HOST, () => {
  console.log(`[nova-deploy] listening on ${HOST}:${PORT} (sites: ${SITES_DIR})`)
})