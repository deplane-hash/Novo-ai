import { useState } from 'react'
import type { ProviderDefinition, PublicState } from '../types'
import { saveConfig, validateKey } from '../api'

interface Props {
  providers: ProviderDefinition[]
  state: PublicState | null
  onClose: () => void
  onSaved: (state: PublicState) => void
}

export default function SettingsModal({ providers, state, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<string>('general')
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({})
  const [workspace, setWorkspace] = useState<string>(state?.workspace ?? '')
  const [planMode, setPlanMode] = useState<boolean>(state?.planMode ?? false)
  const [autoApprove, setAutoApprove] = useState<boolean>(state?.autoApprove ?? false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [checking, setChecking] = useState<string | null>(null)

  const provider = providers.find((p) => p.id === tab)
  const st = tab !== 'general' ? state?.providers[tab] : undefined
  const keyInput = keys[tab] ?? ''
  const baseUrlInput = baseUrls[tab] ?? st?.baseUrl ?? ''

  const saveAll = async () => {
    setSaving(true)
    setMessage(null)
    try {
      let next = state!
      for (const p of providers) {
        const k = keys[p.id]
        const b = baseUrls[p.id]
        if (k && k.trim()) {
          const r = await saveConfig({ providerId: p.id, apiKey: k.trim(), ...(b ? { baseUrl: b } : {}) })
          next = r.state
        } else if (b && b !== st?.baseUrl) {
          const r = await saveConfig({ providerId: p.id, apiKey: '', baseUrl: b })
          next = r.state
        }
      }
      if (workspace && workspace !== state?.workspace) {
        const r = await saveConfig({ workspace })
        next = r.state
      }
      if (planMode !== state?.planMode || autoApprove !== state?.autoApprove) {
        const r = await saveConfig({ planMode, autoApprove })
        next = r.state
      }
      onSaved(next)
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  const checkKey = async () => {
    if (!st?.configured) {
      setMessage({ kind: 'err', text: 'Save the key first, then test it.' })
      return
    }
    setChecking(tab)
    setMessage(null)
    const r = await validateKey(tab)
    setChecking(null)
    setMessage(r.ok ? { kind: 'ok', text: `✓ ${provider?.name} key is valid` } : { kind: 'err', text: r.error ?? 'check failed' })
  }

  const activeKeySaved = state?.providers[tab]?.configured

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="btn-ghost" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="settings-nav">
            <button className={`provider-tab ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>
              <span className="provider-icon" style={{ background: '#64748b' }}>⚙</span>
              <span>
                <strong>General</strong>
                <small>workspace & behavior</small>
              </span>
            </button>
            {providers.map((p) => (
              <button
                key={p.id}
                className={`provider-tab ${tab === p.id ? 'active' : ''}`}
                onClick={() => setTab(p.id)}
              >
                <span className="provider-icon" style={{ background: p.color }}>{p.icon}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{state?.providers[p.id]?.configured ? 'connected' : 'no key'}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="settings-panel">
            {tab === 'general' ? (
              <>
                <h3>
                  <span className="provider-icon" style={{ background: '#64748b' }}>⚙</span>
                  General
                  <span className="tagline">workspace & behavior</span>
                </h3>

                <label className="field">
                  <span>Workspace folder</span>
                  <input
                    type="text"
                    value={workspace}
                    onChange={(e) => setWorkspace(e.target.value)}
                    placeholder="/home/you/my-project"
                    spellCheck={false}
                  />
                  <small className="muted">Nova can read, write, and run commands inside this folder.</small>
                </label>

                <div className="setting-row">
                  <div>
                    <strong>Auto-Approve</strong>
                    <p className="muted small">Skip the approve/deny prompt and run every change automatically. Use with care.</p>
                  </div>
                  <button type="button" className={`switch ${autoApprove ? 'on' : ''}`} onClick={() => setAutoApprove(!autoApprove)}>
                    <span className="knob" />
                  </button>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>Plan Mode by default</strong>
                    <p className="muted small">Nova explains what it would do without changing anything. You can toggle it anytime in the top bar.</p>
                  </div>
                  <button type="button" className={`switch ${planMode ? 'on' : ''}`} onClick={() => setPlanMode(!planMode)}>
                    <span className="knob" />
                  </button>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>How approval works</strong>
                    <p className="muted small">Read, list, and search run automatically. Writing files, editing, deleting, and running commands ask for your approval first — choose “Always allow” to skip that tool for this conversation.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
            <h3>
              <span className="provider-icon" style={{ background: provider?.color }}>{provider?.icon}</span>
              {provider?.name}
              <span className="tagline">{provider?.tagline}</span>
            </h3>

            {provider?.needsKey ? (
              <>
                <label className="field">
                  <span>API key</span>
                  <input
                    type="password"
                    placeholder={st?.configured ? `${st.keyMasked} — type a new key to replace` : provider?.keyPlaceholder ?? '…'}
                    value={keyInput}
                    onChange={(e) => setKeys((k) => ({ ...k, [tab]: e.target.value }))}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                {provider?.baseUrlEditable && (
                  <label className="field">
                    <span>Base URL</span>
                    <input
                      type="text"
                      value={baseUrlInput}
                      onChange={(e) => setBaseUrls((b) => ({ ...b, [tab]: e.target.value }))}
                      spellCheck={false}
                    />
                  </label>
                )}
                <div className="field-actions">
                  {activeKeySaved ? (
                    <button className="btn-ghost" onClick={checkKey} disabled={checking !== null}>
                      {checking === tab ? 'Checking…' : 'Test key'}
                    </button>
                  ) : null}
                  <span className="muted small">Keys are stored locally in ~/.nova and never leave your machine.</span>
                </div>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Base URL</span>
                  <input
                    type="text"
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrls((b) => ({ ...b, [tab]: e.target.value }))}
                    placeholder={provider?.defaultBaseUrl ?? ''}
                    spellCheck={false}
                  />
                </label>
                <p className="muted small">Local provider — no API key needed. Make sure it is running.</p>
              </>
            )}

            <div className="models-list">
              <span className="muted small">Available models ({provider?.models.length ?? 0})</span>
              <div className="model-chips">
                {provider?.models.slice(0, 24).map((m) => (
                  <span key={m} className="chip">{m}{provider.freeAll || !provider.needsKey || provider.freeModels?.includes(m) ? '  (free)' : ''}</span>
                ))}
                {(provider?.models.length ?? 0) > 24 && provider && (
                  <span className="chip muted">+{provider.models.length - 24} more in the model picker</span>
                )}
              </div>
            </div>
              </>
            )}
          </div>
        </div>

        {message && <div className={`toast ${message.kind}`}>{message.text}</div>}

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
