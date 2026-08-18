import { useEffect, useRef, useState } from 'react'
import type { ProviderDefinition, ProviderState, PublicState, SessionMessage, ToolStep } from '../types'
import Markdown from './Markdown'

interface Props {
  provider?: ProviderDefinition
  providerState?: ProviderState
  state: PublicState | null
  providers: ProviderDefinition[]
  liveModels: string[]
  active: { id: string | null; messages: SessionMessage[]; providerId: string; model: string; title: string }
  loadingSession: boolean
  streaming: boolean
  awaitingApproval: boolean
  inputRef: React.RefObject<HTMLTextAreaElement>
  onSend: (text: string) => void
  onStop: () => void
  onApproval: (stepId: string, decision: 'allow' | 'deny' | 'allow_always') => void
  onSettings: () => void
  onTogglePlanMode: (v: boolean) => void
  onToggleAutoApprove: (v: boolean) => void
  onProviderChange: (providerId: string, model: string) => void
  onOpenFile: (path: string) => void
}

const TOOL_ICON: Record<string, string> = {
  read: '📖',
  write: '📝',
  edit: '✏️',
  delete: '🗑️',
  list: '📂',
  glob: '🔍',
  grep: '🔍',
  bash: '⚡',
  webfetch: '🌐'
}

function ActionCard({
  step,
  awaitingApproval,
  onApproval
}: {
  step: ToolStep
  awaitingApproval: boolean
  onApproval: (stepId: string, decision: 'allow' | 'deny' | 'allow_always') => void
}) {
  const [showOutput, setShowOutput] = useState(step.status === 'error' || step.status === 'denied')
  const icon = TOOL_ICON[step.name] ?? '🛠'
  const isAwaiting = step.status === 'awaiting' && step.needApproval

  useEffect(() => {
    if (step.status === 'error' || step.status === 'denied') setShowOutput(true)
  }, [step.status])

  return (
    <div className={`action-card ${step.status}`}>
      <div className="action-head">
        <span className="action-icon">{icon}</span>
        <div className="action-body">
          <div className="action-title">
            <code>{step.name}</code>
            {step.summary && <span className="action-summary">{step.summary}</span>}
          </div>
          <div className="action-status">
            {step.status === 'awaiting' && <span className="pill warn">needs approval</span>}
            {step.status === 'running' && <span className="pill run"><span className="spinner sm" /> running…</span>}
            {step.status === 'done' && <span className="pill ok">done</span>}
            {step.status === 'error' && <span className="pill err">error</span>}
            {step.status === 'denied' && <span className="pill deny">denied</span>}
          </div>
        </div>
        {step.output && (
          <button className="btn-ghost tiny" onClick={() => setShowOutput((v) => !v)}>
            {showOutput ? 'hide' : 'output'}
          </button>
        )}
      </div>

      {showOutput && step.output && (
        <pre className="action-output">{step.output}</pre>
      )}

      {isAwaiting && (
        <div className="action-actions">
          <button className="btn-primary sm" onClick={() => onApproval(step.id, 'allow')} disabled={awaitingApproval && false}>
            ✔ Approve
          </button>
          <button className="btn-ghost sm" onClick={() => onApproval(step.id, 'allow_always')}>
            ✔ Always allow
          </button>
          <button className="btn-warn sm" onClick={() => onApproval(step.id, 'deny')}>
            ✕ Deny
          </button>
        </div>
      )}
    </div>
  )
}

export default function ChatView({
  provider, providerState, state, providers, liveModels, active, loadingSession, streaming, awaitingApproval,
  inputRef,
  onSend, onStop, onApproval, onSettings, onTogglePlanMode, onToggleAutoApprove, onProviderChange, onOpenFile
}: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const models = liveModels.length ? liveModels : provider?.models ?? []
  const options = Array.from(new Set([active.model, ...models].filter(Boolean)))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active.messages, loadingSession])

  const submit = () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    onSend(text)
  }

  const needsKey = provider?.needsKey && !providerState?.configured
  const isFree = (m: string) => provider?.freeAll || !provider?.needsKey || (provider?.freeModels?.includes(m) ?? false)

  return (
    <main className="chat">
      <header className="chat-head">
        <div className="chat-title">
          <h2>{active.title}</h2>
          <div className="chat-sub">
            {provider?.name ?? '—'} · {active.model || 'select model'}
          </div>
        </div>
      </header>

      <div className="messages">
        {loadingSession && <div className="muted small center">Loading conversation…</div>}
        {active.messages.map((m) => (
          <MessageBubble key={m.id} message={m} awaitingApproval={awaitingApproval} onApproval={onApproval} onOpenFile={onOpenFile} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="composer-wrap">
        {streaming && (
          <div className="thinking">
            <span className="spinner" />
            <span>{awaitingApproval ? 'Waiting for your approval…' : (status === 'executing' ? 'Running tools…' : 'Nova is thinking…')}</span>
          </div>
        )}
        <div className="composer">
          <textarea
            ref={inputRef}
            placeholder={needsKey ? `Add a ${provider?.name} API key in Settings to start` : 'Message Nova…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
          />
          {streaming ? (
            <button className="btn-danger btn-send" onClick={onStop}>■ Stop</button>
          ) : (
            <button className="btn-primary btn-send" onClick={submit} disabled={!input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 11l18-8-8 18-2-8-8-2z" fill="currentColor" />
              </svg>
              Send
            </button>
          )}
        </div>
        <div className="composer-hint">
          <span>Enter to send · Shift+Enter for newline · Ctrl+K to focus</span>
        </div>
      </div>

      <footer className="statusbar">
        <div className="sb-left">
          <div className="sb-pick">
            <span className="sb-pick-icon" style={{ color: provider?.color ?? '#9aa0bb', background: `${provider?.color ?? '#ffffff'}22` }} title={provider?.name}>
              {provider?.icon ?? '◉'}
            </span>
            <select className="sb-select" value={active.providerId} onChange={(e) => onProviderChange(e.target.value, '')} title="Provider">
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>
          </div>
          <select className="sb-select sb-model" value={active.model} onChange={(e) => onProviderChange(active.providerId, e.target.value)} title="Model">
            {options.map((m) => (
              <option key={m} value={m}>{m}{isFree(m) ? '  (free)' : ''}</option>
            ))}
          </select>
          <button
            className={`sb-chip ${state?.planMode ? 'on' : ''}`}
            onClick={() => onTogglePlanMode(!state?.planMode)}
            title="Click to switch between Plan (explains only) and Build (makes changes)"
          >
            {state?.planMode ? '🧭 Plan' : '🛠 Build'}
          </button>
          <button
            className={`sb-chip ${state?.autoApprove ? 'on' : ''}`}
            onClick={() => onToggleAutoApprove(!state?.autoApprove)}
            title="Auto-approve tool actions"
          >
            ⚙ Auto {state?.autoApprove ? 'ON' : 'OFF'}
          </button>
          {needsKey && (
            <button className="sb-chip warn" onClick={onSettings} title="Add API key">🔑 Add key</button>
          )}
          <button className="sb-chip" onClick={onSettings} title="Settings">⚙</button>
        </div>
      </footer>
    </main>
  )
}

function MessageBubble({ message, awaitingApproval, onApproval, onOpenFile }: {
  message: SessionMessage
  awaitingApproval: boolean
  onApproval: (stepId: string, decision: 'allow' | 'deny' | 'allow_always') => void
  onOpenFile: (path: string) => void
}) {
  if (message.role === 'user') {
    return (
      <div className="msg user">
        <div className="bubble user">{message.content}</div>
      </div>
    )
  }
  const isEmpty = !message.content && message.id !== 'welcome'
  const stoppedAt = message.stoppedAfterMs
  const duration =
    stoppedAt !== undefined
      ? stoppedAt < 60000
        ? `${(stoppedAt / 1000).toFixed(1)}s`
        : `${Math.floor(stoppedAt / 60000)}m ${Math.round((stoppedAt % 60000) / 1000)}s`
      : ''
  return (
    <div className="msg ai">
      <div className="ai-avatar">
        <span className="logo-core small" />
      </div>
      <div className="ai-body">
        {message.steps && message.steps.length > 0 && (
          <div className="step-list">
            {message.steps.map((s) => (
              <ActionCard key={s.id} step={s} awaitingApproval={awaitingApproval} onApproval={onApproval} />
            ))}
          </div>
        )}
        <div className={`bubble ai ${isEmpty && !message.stopped ? 'pending' : ''}`}>
          {isEmpty ? (
            message.stopped ? (
              <span className="stopped-note">Stopped after {duration}</span>
            ) : (
              <span className="typing">
                <i /><i /><i />
              </span>
            )
          ) : (
            <Markdown content={message.content} />
          )}
        </div>
        {message.stopped && message.content && (
          <div className="meta-line stopped-meta">Stopped after {duration}</div>
        )}
        {message.usage && message.cost !== undefined && (
          <div className="meta-line">
            <span>{message.providerId || '—'} · {message.model || '—'}</span>
            <span>{message.usage.totalTokens ? `${message.usage.totalTokens.toLocaleString()} tokens` : ''}</span>
            <span>{message.cost > 0 ? `≈ $${message.cost.toFixed(4)}` : ''}</span>
            {message.usage.estimated && <span title="tokens estimated client-side">~</span>}
          </div>
        )}
      </div>
    </div>
  )
}
