import { randomUUID } from 'node:crypto'

type Decision = 'allow' | 'deny' | 'allow_always'

interface Pending {
  chatId: string
  resolve: (d: Decision) => void
  reject: (err: Error) => void
  settled: boolean
}

const pendings = new Map<string, Pending>()
const sessionAllow = new Map<string, Set<string>>()

export function requestApproval(chatId: string): { id: string; decision: Promise<Decision> } {
  const id = randomUUID()
  const decision = new Promise<Decision>((resolve, reject) => {
    pendings.set(id, {
      chatId,
      settled: false,
      resolve: (d) => {
        pendings.delete(id)
        resolve(d)
      },
      reject: (err) => {
        pendings.delete(id)
        reject(err)
      }
    })
  })
  return { id, decision }
}

export function respondToApproval(id: string, decision: Decision): boolean {
  const p = pendings.get(id)
  if (!p || p.settled) return false
  p.settled = true
  p.resolve(decision)
  return true
}

export function rejectAllForChat(chatId: string) {
  for (const [id, p] of pendings) {
    if (p.chatId === chatId) {
      p.settled = true
      p.reject(new Error('Request aborted'))
    }
  }
}

export function isAllowed(sessionId: string, toolName: string): boolean {
  return sessionAllow.get(sessionId)?.has(toolName) ?? false
}

export function rememberAllowed(sessionId: string, toolName: string) {
  if (!sessionAllow.has(sessionId)) sessionAllow.set(sessionId, new Set())
  sessionAllow.get(sessionId)!.add(toolName)
}
