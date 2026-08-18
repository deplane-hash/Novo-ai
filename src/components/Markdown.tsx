import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{language || 'text'}</span>
        <button
          className="btn-ghost"
          onClick={() => {
            navigator.clipboard.writeText(children)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  )
}

export default function Markdown({ content }: { content: string }) {
  const comps = useMemo(
    () => ({
      code({ inline, className, children }: { inline?: boolean; className?: string; children?: unknown }) {
        const text = String(children ?? '')
        const lang = /language-(\w+)/.exec(className ?? '')?.[1] ?? ''
        if (inline) return <code className="inline-code">{text}</code>
        return <CodeBlock language={lang} children={text} />
      },
      a: ({ href, children }: { href?: string; children?: unknown }) => (
        <a href={href} target="_blank" rel="noreferrer">
          {String(children ?? '')}
        </a>
      )
    }),
    []
  )
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={comps}>{content}</ReactMarkdown>
}
