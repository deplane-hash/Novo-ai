import type { ChatMessage, FileNode, ProviderDefinition, PublicState, Session, TodoItem, Usage } from './types'

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      msg = j?.error ?? msg
    } catch {
      /* noop */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function getProviders(): Promise<{ providers: ProviderDefinition[]; state: PublicState }> {
  return j(await fetch('/api/providers'))
}

export async function saveConfig(body: Record<string, unknown>): Promise<{ ok: boolean; state: PublicState }> {
  return j(
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  )
}

export async function validateKey(providerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    return await j(
      await fetch('/api/keys/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      })
    )
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function listSessions(): Promise<Session[]> {
  const r = await j<{ sessions: Session[] }>(await fetch('/api/sessions'))
  return r.sessions
}

export async function createSession(providerId: string, model: string): Promise<Session> {
  const r = await j<{ session: Session }>(
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, model })
    })
  )
  return r.session
}

export async function getSession(id: string): Promise<Session> {
  const r = await j<{ session: Session }>(await fetch(`/api/sessions/${id}`))
  return r.session
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
}

export async function respondApproval(id: string, decision: 'allow' | 'deny' | 'allow_always'): Promise<void> {
  const res = await fetch('/api/tools/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, decision })
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error ?? 'Failed to respond')
  }
}

export async function listWorkspace(dir = '.'): Promise<{ path: string; root: string; nodes: FileNode[] }> {
  const res = await fetch(`/api/fs/list?path=${encodeURIComponent(dir)}`)
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ?? 'Failed to list')
  return j
}

export async function readWorkspaceFile(file: string): Promise<{ path: string; content: string }> {
  const res = await fetch(`/api/fs/read?path=${encodeURIComponent(file)}`)
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ?? 'Failed to read')
  return j
}

export async function listModels(providerId: string): Promise<{ dynamic: boolean; models: string[] }> {
  const res = await fetch(`/api/models?provider=${encodeURIComponent(providerId)}`)
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ?? 'Failed to load models')
  return j
}

export async function listTodos(): Promise<TodoItem[]> {
  const r = await j<{ todos: TodoItem[] }>(await fetch('/api/todos'))
  return r.todos
}

export interface ChatCallbacks {
  onMeta?: (meta: { providerId: string; model: string }) => void
  onChunk: (text: string) => void
  onToolCall?: (call: { id: string; name: string; summary: string; needApproval: boolean }) => void
  onToolApproved?: (id: string) => void
  onToolResult?: (id: string, ok: boolean, output: string) => void
  onPreview?: (path: string) => void
  onDone: (done: { usage?: Usage; cost?: number; durationMs?: number; sessionId?: string; title?: string }) => void
  onError: (message: string) => void
}

export function streamChat(opts: {
  providerId: string
  model: string
  messages: ChatMessage[]
  sessionId?: string
  signal: AbortSignal
}, cb: ChatCallbacks): Promise<void> {
  return new Promise((resolve) => {
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: opts.providerId,
        model: opts.model,
        messages: opts.messages,
        sessionId: opts.sessionId
      }),
      signal: opts.signal
    })
      .then((res) => {
        if (!res.ok || !res.body) {
          return res.text().then((t) => cb.onError(t || `HTTP ${res.status}`))
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let eventName = ''
        const pump = (): Promise<void> => {
          return reader.read().then(({ done, value }) => {
            if (done) {
              resolve()
              return
            }
            buffer += decoder.decode(value, { stream: true })
            let idx: number
            while ((idx = buffer.indexOf('\n\n')) >= 0) {
              const block = buffer.slice(0, idx)
              buffer = buffer.slice(idx + 2)
              let data = ''
              for (const line of block.split('\n')) {
                if (line.startsWith('event:')) eventName = line.slice(6).trim()
                if (line.startsWith('data:')) data += line.slice(5).trim()
              }
              if (!data) continue
              let json: Record<string, unknown>
              try {
                json = JSON.parse(data)
              } catch {
                continue
              }
              switch (eventName) {
                case 'meta':
                  cb.onMeta?.(json as { providerId: string; model: string })
                  break
                case 'chunk':
                  cb.onChunk((json as { text: string }).text)
                  break
                case 'tool_call':
                  cb.onToolCall?.(json as { id: string; name: string; summary: string; needApproval: boolean })
                  break
                case 'tool_approved':
                  cb.onToolApproved?.((json as { id: string }).id)
                  break
                case 'tool_result':
                  cb.onToolResult?.((json as { id: string }).id, (json as { ok: boolean }).ok, (json as { output: string }).output)
                  break
                case 'preview':
                  cb.onPreview?.((json as { path: string }).path)
                  break
                case 'done':
                  cb.onDone(json as { usage?: Usage; cost?: number; durationMs?: number; sessionId?: string; title?: string })
                  break
                case 'error':
                  cb.onError((json as { message: string }).message)
                  break
              }
            }
            return pump()
          })
        }
        return pump()
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') cb.onError(err?.message ?? String(err))
        resolve()
      })
  })
}
