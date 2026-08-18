import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileNode, ProviderDefinition, PublicState, Session, SessionMessage, ToolStep } from './types'
import { getProviders, listSessions, createSession, getSession, deleteSession, streamChat, respondApproval, listWorkspace, readWorkspaceFile, listModels } from './api'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import InfoPanel from './components/InfoPanel'
import LivePreview from './components/LivePreview'
import SettingsModal from './components/SettingsModal'
import FilePreview from './components/FilePreview'
import OnboardingModal from './components/OnboardingModal'

interface ActiveSession {
  id: string | null
  messages: SessionMessage[]
  providerId: string
  model: string
  title: string
}

const WELCOME: SessionMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    '## Welcome to **Nova** ⚡\n\nYour all-in-one AI coding workspace. Ask me to build, fix, or explain anything in your project — I can read files, edit code, and run commands.\n\n**Try saying:**\n\n- *"Show me what\'s in my project"*\n- *"Fix the error in App.tsx"*\n- *"Create a login page"*\n- *"Run the tests"*\n\n> I always ask before changing or executing anything. Keep an eye on the **Files** tab on the left.',
  createdAt: Date.now()
}

export default function App() {
  const [providers, setProviders] = useState<ProviderDefinition[]>([])
  const [state, setState] = useState<PublicState | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [active, setActive] = useState<ActiveSession>({ id: null, messages: [WELCOME], providerId: '', model: '', title: 'New conversation' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [booting, setBooting] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [awaitingApproval, setAwaitingApproval] = useState(false)
  const streamStartRef = useRef(0)
  const streamMsgIdRef = useRef<string | null>(null)

  const [tree, setTree] = useState<FileNode[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [filePanelOpen, setFilePanelOpen] = useState(false)

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [liveModels, setLiveModels] = useState<Record<string, string[]>>({})
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewWidth, setPreviewWidth] = useState(42)
  const [resizing, setResizing] = useState(false)
  const splitRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<{ startX: number; startW: number } | null>(null)

  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointer capture unavailable, overlay still guards */
    }
    dragState.current = { startX: e.clientX, startW: previewWidth }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    setResizing(true)
  }, [previewWidth])

  const onResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = splitRef.current
    if (!el || !dragState.current) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const delta = dragState.current.startX - e.clientX
    const pct = Math.min(75, Math.max(18, dragState.current.startW + (delta / rect.width) * 100))
    setPreviewWidth(pct)
  }, [])

  const endResize = useCallback(() => {
    if (!dragState.current) return
    dragState.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setResizing(false)
  }, [])

  useEffect(() => {
    if (!active.providerId) return
    listModels(active.providerId)
      .then(({ models }) => {
        setLiveModels((m) => ({ ...m, [active.providerId]: models }))
        setActive((a) => {
          if (a.providerId !== active.providerId) return a
          if (!a.model || !models.includes(a.model)) return { ...a, model: models[0] ?? a.model }
          return a
        })
      })
      .catch(() => {})
  }, [active.providerId])

  useEffect(() => {
    ;(async () => {
      try {
        const [prov, s] = await Promise.all([getProviders(), listSessions()])
        setProviders(prov.providers)
        setState(prov.state)
        setSessions(s)
        setActive((a) => ({
          ...a,
          providerId: prov.state.activeProvider || prov.providers[0]?.id || '',
          model: prov.state.activeModel || prov.providers[0]?.models[0] || ''
        }))
        if (!prov.state.onboarded) setShowOnboarding(true)
        try {
          setTree((await listWorkspace('.')).nodes)
        } catch {
          /* noop */
        }
      } catch (e) {
        console.error('boot failed', e)
      } finally {
        setBooting(false)
      }
    })()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        document.body.classList.toggle('sidebar-collapsed')
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === 'Escape') {
        setActiveFile(null)
        setFilePanelOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const refreshSessions = useCallback(async () => {
    setSessions(await listSessions())
  }, [])

  const startNewChat = useCallback(async () => {
    setActive((a) => {
      const next: ActiveSession = { id: null, messages: [WELCOME], providerId: a.providerId, model: a.model, title: 'New conversation' }
      return next
    })
  }, [])

  const openSession = useCallback(
    async (id: string) => {
      if (id === active.id) return
      setLoadingSession(true)
      try {
        const s = await getSession(id)
        setActive({
          id: s.id,
          messages: s.messages.length ? s.messages : [WELCOME],
          providerId: s.providerId || state?.activeProvider || '',
          model: s.model || state?.activeModel || '',
          title: s.title
        })
      } finally {
        setLoadingSession(false)
      }
    },
    [active.id, state]
  )

  const removeSession = useCallback(
    async (id: string) => {
      await deleteSession(id)
      await refreshSessions()
      if (active.id === id) {
        setActive((a) => ({ ...a, id: null, messages: [WELCOME], title: 'New conversation' }))
      }
    },
    [active.id, refreshSessions]
  )

  const openFile = useCallback(
    async (path: string) => {
      try {
        const r = await readWorkspaceFile(path)
        setActiveFile(path)
        setFileContent(r.content)
        setFilePanelOpen(true)
      } catch (e) {
        console.error(e)
      }
    },
    []
  )

  const handleSend = useCallback(
    async (text: string) => {
      const providerId = active.providerId
      const model = active.model
      if (!providerId || !model) {
        setSettingsOpen(true)
        return
      }

      const userMsg: SessionMessage = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: Date.now() }
      const assistantMsg: SessionMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: Date.now() }
      setActive((a) => {
        const prior = a.messages.filter((m) => m.id !== 'welcome')
        return { ...a, id: a.id, messages: [...prior, userMsg, assistantMsg] }
      })

      const history = active.messages
        .filter((m) => m.id !== 'welcome' && m.content)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      const payload = [...history, { role: 'user' as const, content: text }]
      const ctrl = new AbortController()
      abortRef.current = ctrl
      streamStartRef.current = Date.now()
      streamMsgIdRef.current = assistantMsg.id
      setStreaming(true)
      setAwaitingApproval(false)

      const updateAssistant = (patch: (m: SessionMessage) => SessionMessage) => {
        setActive((a) => ({
          ...a,
          messages: a.messages.map((m) => (m.id === assistantMsg.id ? patch(m) : m))
        }))
      }

      await streamChat(
        { providerId, model, messages: payload, sessionId: active.id ?? undefined, signal: ctrl.signal },
        {
          onChunk: (delta) => {
            updateAssistant((m) => ({ ...m, content: m.content + delta }))
          },
          onToolCall: ({ id, name, summary, needApproval }) => {
            if (needApproval) setAwaitingApproval(true)
            const step: ToolStep = { id, name, summary, status: needApproval ? 'awaiting' : 'running', needApproval }
            updateAssistant((m) => ({ ...m, steps: [...(m.steps ?? []), step] }))
          },
          onToolApproved: (id) => {
            updateAssistant((m) => ({
              ...m,
              steps: (m.steps ?? []).map((s) => (s.id === id ? { ...s, status: 'running', needApproval: false } : s))
            }))
          },
          onToolResult: (id, ok, output) => {
            setAwaitingApproval(false)
            const denied = !ok && output === 'Denied by user'
            updateAssistant((m) => ({
              ...m,
              steps: (m.steps ?? []).map((s) =>
                s.id === id ? { ...s, status: denied ? 'denied' : ok ? 'done' : 'error', output } : s
              )
            }))
          },
          onPreview: (p) => {
            setPreview(p)
            setPreviewOpen(true)
          },
          onDone: async (done) => {
            setStreaming(false)
            setAwaitingApproval(false)
            setActive((a) => ({
              ...a,
              id: done.sessionId ?? a.id,
              title: done.title ?? a.title,
              messages: a.messages.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, usage: done.usage, cost: done.cost, durationMs: done.durationMs, providerId, model }
                  : m
              )
            }))
            await refreshSessions()
          },
          onError: (msg) => {
            setStreaming(false)
            setAwaitingApproval(false)
            updateAssistant((m) => ({
              ...m,
              content: m.content || `⚠️ **Error:** ${msg}`
            }))
          }
        }
      )
      setStreaming(false)
      await refreshSessions()
    },
    [active, refreshSessions]
  )

  const handleWorkOn = useCallback(
    (target: string, isDir: boolean) => {
      if (streaming) return
      const ask = isDir
        ? `Let's work on the folder \`${target}\`. Explore its structure first to understand it, then I'll tell you what I want to build or change.`
        : `Let's work on the file \`${target}\`. Read it first to understand it, then I'll tell you what I want to build or change.`
      void handleSend(ask)
    },
    [handleSend, streaming]
  )

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setAwaitingApproval(false)
    const id = streamMsgIdRef.current
    if (id) {
      setActive((a) => ({
        ...a,
        messages: a.messages.map((m) =>
          m.id === id ? { ...m, stopped: true, stoppedAfterMs: Math.max(Date.now() - streamStartRef.current, 0) } : m
        )
      }))
    }
  }, [])

  const handleApproval = useCallback(async (stepId: string, decision: 'allow' | 'deny' | 'allow_always') => {
    try {
      await respondApproval(stepId, decision)
      if (decision !== 'allow_always') {
        setActive((a) => ({
          ...a,
          messages: a.messages.map((m) => ({
            ...m,
            steps: (m.steps ?? []).map((s) => (s.id === stepId ? { ...s, needApproval: false } : s))
          }))
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const togglePlanMode = useCallback((v: boolean) => {
    setState((s) => (s ? { ...s, planMode: v } : s))
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planMode: v })
    }).catch(() => {})
  }, [])

  const toggleAutoApprove = useCallback((v: boolean) => {
    setState((s) => (s ? { ...s, autoApprove: v } : s))
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoApprove: v })
    }).catch(() => {})
  }, [])

  const provider = providers.find((p) => p.id === active.providerId)
  const providerState = state?.providers[active.providerId]
  const lastMsg = active.messages[active.messages.length - 1]
  const status: 'idle' | 'thinking' | 'executing' | 'error' =
    awaitingApproval ? 'executing'
    : streaming ? (lastMsg?.steps?.length ? 'executing' : 'thinking')
    : (lastMsg?.content.startsWith('⚠️ **Error') ? 'error' : 'idle')

  return (
    <div className="app">
      <div className="aurora" aria-hidden />
      <div className="grid-bg" aria-hidden />
      <Sidebar
        sessions={sessions}
        activeId={active.id}
        tree={tree}
        onNew={startNewChat}
        onOpen={openSession}
        onDelete={removeSession}
        onSettings={() => setSettingsOpen(true)}
        onOpenFile={openFile}
        onWorkOn={handleWorkOn}
        booting={booting}
        workspaceName={state?.workspace ?? ''}
        status={status}
      />
      <div className="chat-split" ref={splitRef}>
        <ChatView
          provider={provider}
          providerState={providerState}
          state={state}
          providers={providers}
          liveModels={liveModels[active.providerId] ?? []}
          active={active}
          loadingSession={loadingSession}
          streaming={streaming}
          awaitingApproval={awaitingApproval}
          inputRef={inputRef}
          onSend={handleSend}
          onStop={handleStop}
          onApproval={handleApproval}
          onSettings={() => setSettingsOpen(true)}
          onTogglePlanMode={togglePlanMode}
          onToggleAutoApprove={toggleAutoApprove}
          onProviderChange={(pid, model) => {
            const p = providers.find((x) => x.id === pid)
            const list = (liveModels[pid]?.length ? liveModels[pid] : p?.models) ?? []
            const nextModel = model && list.includes(model) ? model : (list[0] ?? '')
            setActive((a) => (a.providerId === pid && a.model === nextModel ? a : { ...a, providerId: pid, model: nextModel }))
            setState((s) => (s ? { ...s, activeProvider: pid, activeModel: nextModel } : s))
            fetch('/api/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ activeProvider: pid, activeModel: nextModel })
            }).catch(() => {})
          }}
          onOpenFile={openFile}
        />
        {preview && previewOpen && (
          <>
            <div
              className={`split-divider${resizing ? ' resizing' : ''}`}
              onPointerDown={startResize}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              title="Drag to resize"
            />
            <div className="chat-preview-half" style={{ flex: `0 0 ${previewWidth}%` }}>
              <LivePreview path={preview} variant="panel" onClose={() => setPreviewOpen(false)} />
            </div>
          </>
        )}
        {resizing && <div className="resize-overlay" />}
        {preview && !previewOpen && (
          <button className="preview-reopen" onClick={() => setPreviewOpen(true)} title="Open preview">
            ◉
          </button>
        )}
      </div>
      <InfoPanel
        providerId={active.providerId}
        model={active.model}
        title={active.title}
        messages={active.messages}
        streaming={streaming}
        status={status}
      />
      {filePanelOpen && activeFile && (
        <FilePreview path={activeFile} content={fileContent} onClose={() => { setFilePanelOpen(false); setActiveFile(null) }} />
      )}
      {settingsOpen && (
        <SettingsModal
          providers={providers}
          state={state}
          onClose={() => setSettingsOpen(false)}
          onSaved={(newState) => {
            setState(newState)
            setSettingsOpen(false)
            listWorkspace('.').then((r) => setTree(r.nodes)).catch(() => {})
          }}
        />
      )}
      {showOnboarding && (
        <OnboardingModal
          onComplete={() => {
            setShowOnboarding(false)
            fetch('/api/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ onboarded: true })
            }).catch(() => {})
          }}
        />
      )}
    </div>
  )
}
