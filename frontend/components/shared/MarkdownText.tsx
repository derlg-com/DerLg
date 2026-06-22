import { Fragment, type ReactNode } from 'react'

/**
 * Minimal, XSS-safe inline markdown. Renders `**bold**` as <strong> and keeps
 * line breaks, building pure React nodes (no dangerouslySetInnerHTML). Good
 * enough for the concierge's scannable answers and per-card blurbs.
 */
export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const lines = (text ?? '').split('\n')
  return (
    <span className={className}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {renderInline(line)}
        </Fragment>
      ))}
    </span>
  )
}

function renderInline(line: string): ReactNode {
  // Split on **bold** segments, keeping the delimiters via a capture group.
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
