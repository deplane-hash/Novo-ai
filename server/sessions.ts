import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface ToolStep {
  id: string
  name: string
  summary: string
  status: 'awaiting' | 'running' | 'done' | 'error' | 'denied'
  output?: string
  needApproval?: boolean
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  providerId?: string
  model?: string
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number; estimated?: boolean }
  cost?: number
  steps?: ToolStep[]
  createdAt: number
}

export interface Session {
  id: string
  title: string
  providerId: string
  model: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
}

const SESSIONS_DIR = path.join(os.homedir(), '.nova', 'sessions')

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

function fileFor(id: string) {
  return path.join(SESSIONS_DIR, `${id}.json`)
}

export function safeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function listSessions(): Session[] {
  ensureDir()
  const sessions: Session[] = []
  for (const f of fs.readdirSync(SESSIONS_DIR)) {
    if (!f.endsWith('.json')) continue
    try {
      const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8')) as Session
      sessions.push(s)
    } catch {
      /* skip corrupt */
    }
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getSession(id: string): Session | null {
  try {
    if (fs.existsSync(fileFor(id))) {
      return JSON.parse(fs.readFileSync(fileFor(id), 'utf-8')) as Session
    }
  } catch {
    /* noop */
  }
  return null
}

export function saveSession(session: Session) {
  ensureDir()
  session.updatedAt = Date.now()
  const tmp = fileFor(session.id) + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(session, null, 2), 'utf-8')
  fs.renameSync(tmp, fileFor(session.id))
}

export function deleteSession(id: string) {
  try {
    fs.unlinkSync(fileFor(id))
  } catch {
    /* noop */
  }
}

export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= 60) return clean || 'New conversation'
  return clean.slice(0, 57).trimEnd() + '…'
}
