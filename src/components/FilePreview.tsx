import { useMemo } from 'react'
import Editor from '@monaco-editor/react'

function extToLang(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    json: 'json', py: 'python', html: 'html', css: 'css', scss: 'scss', md: 'markdown',
    sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml', java: 'java', go: 'go',
    rs: 'rust', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', rb: 'ruby', php: 'php', sql: 'sql',
    toml: 'toml', xml: 'xml', svg: 'xml', vue: 'html', svelte: 'html'
  }
  return map[ext] ?? 'plaintext'
}

export default function FilePreview({ path, content, onClose }: { path: string; content: string; onClose: () => void }) {
  const lang = useMemo(() => extToLang(path), [path])
  const isHtml = /\.html?$/i.test(path)

  return (
    <aside className="file-preview">
      <div className="fp-head">
        <div className="fp-title">
          <span className="fp-icon">📄</span>
          <span>{path}</span>
        </div>
        <div className="fp-actions">
          {isHtml && (
            <a className="btn-ghost tiny" href={`/preview/${path.replace(/^\/+/, '')}`} target="_blank" rel="noreferrer">
              ▶ Live preview
            </a>
          )}
          <button className="btn-ghost tiny" onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="fp-editor">
        <Editor
          defaultLanguage={lang}
          value={content}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderLineHighlight: 'none'
          }}
        />
      </div>
    </aside>
  )
}
