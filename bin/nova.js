#!/usr/bin/env node
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execFileP = promisify(execFile)
const args = process.argv.slice(2)

function argValue(flag, fallback) {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const DEPLOY_API = process.env.NOVA_DEPLOY_API || 'https://deploy.freedomhub.at/api'
const NOVA_DIR = path.join(os.homedir(), '.nova')
const DEPLOY_TOKEN_FILE = path.join(NOVA_DIR, 'deploy-token')

function readDeployToken() {
  try {
    const t = fs.readFileSync(DEPLOY_TOKEN_FILE, 'utf-8').trim()
    if (t) return t
  } catch {}
  return process.env.NOVA_DEPLOY_TOKEN || ''
}

function saveDeployToken(token) {
  fs.mkdirSync(NOVA_DIR, { recursive: true })
  fs.writeFileSync(DEPLOY_TOKEN_FILE, token, 'utf-8')
}

function isDeployCommand() {
  return ['deploy', 'register', 'info', 'delete', 'list', 'upgrade'].includes(args[0])
}

async function runDeployCommand() {
  const cmd = args[0]

  if (cmd === 'register') {
    try {
      const res = await fetch(`${DEPLOY_API}/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'free' })
      })
      const data = await res.json()
      if (!data.ok) {
        console.log(`\n  ✗ ${data.error}\n`)
        if (typeof data.url === 'string') console.log(`    ${data.url}`)
        process.exit(1)
      }
      saveDeployToken(data.token)
      console.log(`
  ✔ Free hosting token created for this PC!

    Plan:  ${data.plan} (free = 1 site, 25 MB)
    Token: ${data.token}

  Deploy your first site:
    nova deploy
`)
    } catch (err) {
      console.log(`\n  ✗ Could not reach the hosting service: ${err.message}\n`)
      process.exit(1)
    }
    return
  }

  if (cmd === 'info') {
    const token = args.includes('--token') ? argValue('--token', '') : readDeployToken()
    if (!token) {
      console.log('\n  No deploy token found. Run `nova register` first.\n')
      process.exit(1)
    }
    try {
      const res = await fetch(`${DEPLOY_API}/info`, { headers: { 'x-nova-token': token } })
      const data = await res.json()
      if (!data.ok) {
        console.log(`\n  ✗ ${data.error}\n`)
        process.exit(1)
      }
      const sites = Array.isArray(data.sites) ? data.sites : []
      console.log(`
  Nova hosting
    Plan:  ${data.plan}
    Sites (${sites.length}):${sites.length ? '\n    ' + sites.join('\n    ') : '  none yet'}
`)
    } catch (err) {
      console.log(`\n  ✗ Could not reach the hosting service: ${err.message}\n`)
      process.exit(1)
    }
    return
  }

  if (cmd === 'delete') {
    const siteName = args[1]
    if (!siteName) {
      console.log(`\n  ✗ Usage: nova delete <site-name>\n`)
      process.exit(1)
    }
    const token = args.includes('--token') ? argValue('--token', '') : readDeployToken()
    if (!token) {
      console.log(`\n  ✗ No deploy token found. Run \`nova register\` first.\n`)
      process.exit(1)
    }
    try {
      const res = await fetch(`${DEPLOY_API}/api/site/${encodeURIComponent(siteName)}`, {
        method: 'DELETE',
        headers: { 'x-nova-token': token }
      })
      const data = await res.json()
      if (!data.ok) {
        console.log(`\n  ✗ ${data.error}\n`)
        process.exit(1)
      }
      console.log(`\n  ✔ Deleted ${siteName} successfully.\n`)
    } catch (err) {
      console.log(`\n  ✗ Could not reach the hosting service: ${err.message}\n`)
      process.exit(1)
    }
    return
  }

  if (cmd === 'list') {
    const token = args.includes('--token') ? argValue('--token', '') : readDeployToken()
    if (!token) {
      console.log(`\n  ✗ No deploy token found. Run \`nova register\` first.\n`)
      process.exit(1)
    }
    try {
      const res = await fetch(`${DEPLOY_API}/api/sites`, { headers: { 'x-nova-token': token } })
      const data = await res.json()
      if (!data.ok) {
        console.log(`\n  ✗ ${data.error}\n`)
        process.exit(1)
      }
      const sites = data.sites || []
      console.log(`
  Nova hosting
    Plan:  ${data.account}
    Sites (${sites.length}):${sites.length ? '\n    ' + sites.join('\n    ') : '  none yet'}
  `)
    } catch (err) {
      console.log(`\n  ✗ Could not reach the hosting service: ${err.message}\n`)
      process.exit(1)
    }
    return
  }

  if (cmd === 'upgrade') {
    const target = args[1]
    const token = args.includes('--token') ? argValue('--token', '') : readDeployToken()
    if (!token) {
      console.log(`\n  ✗ No deploy token found. Run \`nova register\` first.\n`)
      process.exit(1)
    }
    if (target) {
      try {
        const res = await fetch(`${DEPLOY_API}/api/upgrade`, {
          method: 'POST',
          headers: { 'x-nova-token': token, 'content-type': 'application/json' },
          body: JSON.stringify({ token: target }),
        })
        const data = await res.json()
        if (!data.ok) {
          console.log(`\n  ✗ ${data.error}\n`)
          process.exit(1)
        }
        console.log(`\n  ✔ ${target} upgraded to Pro.\n`)
      } catch (err) {
        console.log(`\n  ✗ Could not reach the hosting service: ${err.message}\n`)
        process.exit(1)
      }
      return
    }
    console.log(`\n  Upgrade path: use admin token with a free account:\n    nova upgrade --token <admin> --for <free-token>\n`)
    return
  }

  // === deploy ===
  const token = args.includes('--token') ? argValue('--token', '') : readDeployToken()
  if (!token) {
    console.log(`
  ✗ No hosting token found.
    Run \`nova register\` to get your free token, or deploy with:
    nova deploy --token <your-token>
`)
    process.exit(1)
  }

  const target = argValue('--path', args[1] || '.')
  const absTarget = path.resolve(target)
  if (!fs.existsSync(absTarget) || !fs.statSync(absTarget).isDirectory()) {
    console.log(`\n  ✗ Not a directory: ${target}\n`)
    process.exit(1)
  }

  const defaultName = path
    .basename(absTarget)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const siteName = (argValue('--name', defaultName) || 'site').toLowerCase()
  if (!siteName || !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(siteName)) {
    console.log(`\n  ✗ Invalid site name: "${siteName}" — use a-z, 0-9, hyphens (e.g. --name my-site)\n`)
    process.exit(1)
  }

  console.log(`\n  📦 Packing "${absTarget}" ...`)
  const tarPath = path.join(os.tmpdir(), `nova-deploy-${siteName}-${Date.now()}.tgz`)
  const excludes = ['node_modules', '.git', '.nova', '__nova__', '.next', 'dist', 'build', 'vendor']
  try {
    const flags = excludes.map((e) => '--exclude=' + e)
    await execFileP('tar', ['-czf', tarPath, ...flags, '-C', absTarget, '.'])
  } catch (err) {
    console.log(`\n  ✗ Failed to pack the folder: ${err.message}\n`)
    process.exit(1)
  }

  const size = fs.statSync(tarPath).size
  console.log(`  Uploading ${(size / 1024).toFixed(0)} KB to ${siteName}.freedomhub.at ...`)
  try {
    const body = fs.readFileSync(tarPath)
    const res = await fetch(`${DEPLOY_API}/deploy`, {
      method: 'POST',
      headers: {
        'x-nova-token': token,
        'x-nova-site': siteName,
        'content-type': 'application/gzip'
      },
      body
    })
    const data = await res.json()
    fs.rmSync(tarPath, { force: true })
    if (!data.ok) {
      console.log(`\n  ✗ ${data.error}\n`)
      process.exit(1)
    }
    console.log(`
  ✔ ${siteName} is live!

    📍  ${data.url}
    🚀  Sharing ready — send the link to anyone.
`)
  } catch (err) {
    fs.rmSync(tarPath, { force: true })
    console.log(`\n  ✗ Could not reach the hosting service: ${err.message}\n`)
    process.exit(1)
  }
}

if (isDeployCommand()) {
  await runDeployCommand()
  process.exit(0)
}

if (args.includes('-h') || args.includes('--help')) {
  console.log(`
  nova — your all-in-one AI workspace client

  Usage:
    nova                     start Nova (localhost, auto-opens your browser)
    nova --port 3000         use a specific port
    nova --host 0.0.0.0      listen on all interfaces (LAN access)
    nova --no-open           don't auto-open the browser
    nova deploy [dir]        publish a folder as yourname.freedomhub.at
    nova register            get your free hosting token
    nova info                show your hosting plan + sites
    nova --help              show this help

  Your workspace, sessions, and API keys are stored locally under ~/.nova.
  Add an OpenRouter or OpenAI key in Settings on first launch to get started.
`)
  process.exit(0)
}

const port = Number(argValue('--port', process.env.PORT || 8787))
const host = argValue('--host', process.env.HOST || '127.0.0.1')
const open = !args.includes('--no-open')

process.env.NODE_ENV = 'production'
process.env.PORT = String(port)
process.env.HOST = host

const serverPath = path.resolve(__dirname, '..', 'dist-server', 'index.js')
if (!fs.existsSync(serverPath)) {
  console.error('\n  ✗ Nova is not built. Install the full package (frontend + server).\n')
  process.exit(1)
}

const url = `http://${host}:${port}`

console.log(`
  ╭──────────────────────────────────────────────╮
  │   ⚡ Nova — AI workspace client              │
  │   Local:  ${url.padEnd(31)}│
  │   Deploy: nova deploy                       │
  ╰──────────────────────────────────────────────╯
`)

const serverUrl = pathToFileURL(serverPath).href

import(serverUrl).catch((err) => {
  console.error('[nova] failed to start server:', err)
  process.exit(1)
})

async function openBrowser(target) {
  const cmd =
    process.platform === 'darwin'
      ? `open "${target}"`
      : process.platform === 'win32'
        ? `start "" "${target}"`
        : `xdg-open "${target}"`
  exec(cmd, () => {})
}

if (open) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`${url}/api/health`)
      break
    } catch {
      await wait(250)
    }
  }
  await wait(300)
  try {
    await openBrowser(url)
  } catch {
    /* browser open is best-effort */
  }
}