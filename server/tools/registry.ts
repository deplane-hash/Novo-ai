import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  perm: 'auto' | 'approve'
}

export interface ToolResult {
  ok: boolean
  output: string
  error?: string
}

export interface ToolContext {
  workspace: string
}

const MAX_OUTPUT = 12000

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT) return s
  return s.slice(0, MAX_OUTPUT) + '\n… [output truncated]'
}

export function resolveSafe(ctx: ToolContext, input: string): string {
  const base = path.resolve(ctx.workspace)
  const target = path.resolve(base, input)
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error(`Path "${input}" is outside the workspace (${base}).`)
  }
  return target
}

export const TOOLS: ToolDef[] = [
  {
    name: 'read',
    description:
      'Read a file and return its contents with line numbers. Use offset (1-based) and limit to read sections of large files.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path, relative to workspace' },
        offset: { type: 'number', description: 'Starting line (1-based). Default 1' },
        limit: { type: 'number', description: 'Number of lines to read. Default all' }
      },
      required: ['path']
    },
    perm: 'auto'
  },
  {
    name: 'write',
    description: 'Create a new file or overwrite an existing one with the given content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path, relative to workspace' },
        content: { type: 'string', description: 'Full file content' }
      },
      required: ['path', 'content']
    },
    perm: 'approve'
  },
  {
    name: 'edit',
    description:
      'Apply surgical edits to an existing file using exact string replacements. Each edit replaces oldString with newString. If replaceAll is true, every occurrence is replaced.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path, relative to workspace' },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              oldString: { type: 'string' },
              newString: { type: 'string' },
              replaceAll: { type: 'boolean', description: 'Replace every occurrence instead of requiring a unique match' }
            },
            required: ['oldString', 'newString']
          }
        }
      },
      required: ['path', 'edits']
    },
    perm: 'approve'
  },
  {
    name: 'delete',
    description: 'Permanently delete a file or directory. Use with caution.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete, relative to workspace' }
      },
      required: ['path']
    },
    perm: 'approve'
  },
  {
    name: 'list',
    description: 'List files and directories. Filter by type (file/dir) or name pattern.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to list. Default workspace root' },
        pattern: { type: 'string', description: 'Optional glob pattern to filter names' }
      }
    },
    perm: 'auto'
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern, e.g. "**/*.ts" or "src/**/*.{js,ts}".',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern' },
        path: { type: 'string', description: 'Root directory to search. Default workspace root' }
      },
      required: ['pattern']
    },
    perm: 'auto'
  },
  {
    name: 'grep',
    description: 'Search file contents with a regular expression. Returns file:line matches.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regular expression to search for' },
        path: { type: 'string', description: 'Directory to search. Default workspace root' },
        glob: { type: 'string', description: 'Only search files matching this glob, e.g. "*.ts"' }
      },
      required: ['pattern']
    },
    perm: 'auto'
  },
  {
name: 'bash',
      description:
        'Run a shell command — bash on Linux/macOS, cmd (Command Prompt) on Windows. Use for git, npm, node, python, and any system task. Output is captured.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run' },
        timeoutMs: { type: 'number', description: 'Timeout in milliseconds. Default 60000' }
      },
      required: ['command']
    },
    perm: 'approve'
  },
  {
    name: 'webfetch',
    description: 'Fetch a URL and return the content as text. Useful for reading documentation or web pages.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL to fetch' }
      },
      required: ['url']
    },
    perm: 'auto'
  },
  {
    name: 'preview',
    description:
      'Open a live preview of an HTML page (or other web UI file) in the workspace. The user sees it rendered in a browser panel that auto-refreshes as you edit it. Call this whenever you build or modify a web UI.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'HTML file path, relative to workspace' }
      },
      required: ['path']
    },
    perm: 'auto'
  }
]

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]))

async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  switch (name) {
    case 'read': {
      const p = resolveSafe(ctx, String(args.path ?? ''))
      const offset = Number(args.offset ?? 1)
      const limit = args.limit != null ? Number(args.limit) : Infinity
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new Error(`File not found: ${p}`)
      const lines = fs.readFileSync(p, 'utf-8').split('\n')
      const start = Math.max(1, offset)
      const slice = lines.slice(start - 1, start - 1 + limit)
      const numbered = slice.map((l, i) => `${String(start + i).padStart(5)}: ${l}`).join('\n')
      return { ok: true, output: truncate(`${p}\n${numbered}`) }
    }
    case 'write': {
      const p = resolveSafe(ctx, String(args.path ?? ''))
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, String(args.content ?? ''), 'utf-8')
      return { ok: true, output: `Wrote ${p} (${String(args.content ?? '').length} chars)` }
    }
    case 'edit': {
      const p = resolveSafe(ctx, String(args.path ?? ''))
      if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`)
      const original = fs.readFileSync(p, 'utf-8')
      let current = original
      const edits = Array.isArray(args.edits) ? (args.edits as { oldString?: string; newString?: string; replaceAll?: boolean }[]) : []
      let count = 0
      for (const e of edits) {
        const oldS = String(e.oldString ?? '')
        if (!oldS) throw new Error('edit: empty oldString')
        const newS = String(e.newString ?? '')
        if (e.replaceAll) {
          if (!current.includes(oldS)) throw new Error(`edit: "${oldS}" not found in ${p}`)
          const occurrences = current.split(oldS).length - 1
          current = current.split(oldS).join(newS)
          count += occurrences
        } else {
          const idx = current.indexOf(oldS)
          if (idx === -1) throw new Error(`edit: "${oldS}" not found in ${p}`)
          if (current.indexOf(oldS, idx + 1) !== -1) throw new Error(`edit: "${oldS}" is not unique in ${p} — include more context or set replaceAll`)
          current = current.slice(0, idx) + newS + current.slice(idx + oldS.length)
          count++
        }
      }
      fs.writeFileSync(p, current, 'utf-8')
      return { ok: true, output: `Applied ${count} edit${count === 1 ? '' : 's'} to ${p}` }
    }
    case 'delete': {
      const p = resolveSafe(ctx, String(args.path ?? ''))
      if (!fs.existsSync(p)) throw new Error(`Not found: ${p}`)
      fs.rmSync(p, { recursive: true, force: true })
      return { ok: true, output: `Deleted ${p}` }
    }
    case 'list': {
      const dir = resolveSafe(ctx, String(args.path ?? '.'))
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Not a directory: ${dir}`)
      const entries = fs.readdirSync(dir)
      const pattern = args.pattern ? new RegExp(String(args.pattern).replace(/\./g, '\\.').replace(/\*/g, '.*')) : null
      const lines = entries
        .filter((e) => !pattern || pattern.test(e))
        .map((e) => {
          const full = path.join(dir, e)
          let st
          try {
            st = fs.statSync(full)
          } catch {
            return `  ${e}`
          }
          return `${st.isDirectory() ? 'dir ' : 'file'}  ${e}${st.isDirectory() ? '/' : ''}`
        })
      return { ok: true, output: truncate(`Directory: ${dir}\n${lines.join('\n')}`) }
    }
    case 'glob': {
      const { default: fg } = await import('fast-glob')
      const root = resolveSafe(ctx, String(args.path ?? '.'))
      const matches = await fg(String(args.pattern ?? ''), { cwd: root, onlyFiles: true, dot: true })
      return { ok: true, output: truncate(matches.map((m) => String(m)).join('\n')) }
    }
    case 'grep': {
      const { default: fg } = await import('fast-glob')
      const root = resolveSafe(ctx, String(args.path ?? '.'))
      const pattern = String(args.pattern ?? '')
      const glob = args.glob ? String(args.glob) : '**/*'
      const re = new RegExp(pattern)
      const files = await fg(glob, { cwd: root, onlyFiles: true, dot: true, ignore: ['**/node_modules/**', '**/.git/**'] })
      const lines: string[] = []
      let hitCount = 0
      for (const rel of files.slice(0, 400)) {
        const full = path.join(root, rel)
        let content: string
        try {
          const buf = fs.readFileSync(full)
          if (buf.includes(0)) continue
          content = buf.toString('utf-8')
        } catch {
          continue
        }
        for (const line of content.split('\n')) {
          if (re.test(line)) {
            lines.push(`${rel}:${line.trimEnd().slice(0, 300)}`)
            if (++hitCount >= 200) {
              lines.push('… [result limit reached]')
              break
            }
          }
        }
        if (hitCount >= 200) break
      }
      return { ok: true, output: truncate(lines.join('\n') || 'No matches') }
    }
    case 'bash': {
      const command = String(args.command ?? '')
      const timeout = Number(args.timeoutMs ?? 60000)
      const out = await runBash(command, timeout, ctx.workspace)
      return out
    }
    case 'webfetch': {
      const url = String(args.url ?? '')
      const res = await fetch(url, { headers: { 'User-Agent': 'NovaAI/0.1' } })
      if (!res.ok) throw new Error(`webfetch ${res.status} for ${url}`)
      const text = await res.text()
      return { ok: true, output: truncate(text) }
    }
    case 'preview': {
      const p = resolveSafe(ctx, String(args.path ?? ''))
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new Error(`File not found: ${p}`)
      return { ok: true, output: `Preview ready: ${p}` }
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

function runBash(command: string, timeoutMs: number, cwd: string): Promise<ToolResult> {
  return new Promise((resolve) => {
    const workDir = fs.existsSync(cwd) ? cwd : os.homedir()
    const onWindows = process.platform === 'win32'
    const shell = onWindows ? process.env.ComSpec || 'cmd.exe' : '/bin/bash'
    const args = onWindows
      ? ['/d', '/s', '/c', `chcp 65001 >nul & ${command}`]
      : ['-c', command]
    const child = spawn(shell, args, { cwd: workDir, env: { ...process.env, TERM: 'dumb' } })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ ok: false, output: `Failed to start: ${err.message}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const combined = [stdout, stderr && `\n[stderr]\n${stderr}`].filter(Boolean).join('')
      resolve({
        ok: code === 0,
        output: truncate(combined || `(exit ${code})`),
        error: timedOut ? `Timed out after ${timeoutMs}ms` : code !== 0 ? `exit code ${code}` : undefined
      })
    })
  })
}

export async function executeTool(name: string, rawArgs: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  try {
    return await runTool(name, rawArgs ?? {}, ctx)
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : String(err), error: err instanceof Error ? err.message : String(err) }
  }
}

export function describeTool(name: string, args: Record<string, unknown>): string {
  const a = args ?? {}
  switch (name) {
    case 'read':
    case 'write':
    case 'edit':
    case 'delete':
    case 'list':
    case 'glob':
    case 'grep':
      return String(a.path ?? a.pattern ?? a.glob ?? '')
    case 'bash':
      return String(a.command ?? '').split('\n')[0].slice(0, 90)
    case 'webfetch':
      return String(a.url ?? '')
    case 'preview':
      return String(a.path ?? '')
    default:
      return ''
  }
}
