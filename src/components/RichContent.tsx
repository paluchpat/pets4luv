import React, { type ReactNode } from 'react'
import { resolvePublicHref } from '@/lib/site-links'

type RichNode = { type?: string; text?: string; format?: number; tag?: string; url?: string; fields?: { url?: string; newTab?: boolean }; children?: RichNode[] }

function render(node: RichNode, key: number): ReactNode {
  if (node.type === 'text') {
    let value: ReactNode = node.text || ''
    if ((node.format || 0) & 1) value = <strong>{value}</strong>
    if ((node.format || 0) & 2) value = <em>{value}</em>
    return <span key={key}>{value}</span>
  }
  const children = node.children?.map(render)
  if (node.type === 'paragraph') return <p key={key}>{children}</p>
  if (node.type === 'heading') return node.tag === 'h3' ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>
  if (node.type === 'list') return node.tag === 'ol' ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>
  if (node.type === 'listitem') return <li key={key}>{children}</li>
  if (node.type === 'linebreak') return <br key={key} />
  if (node.type === 'quote') return <blockquote key={key}>{children}</blockquote>
  if (node.type === 'link' || node.type === 'autolink') {
    const url = resolvePublicHref(node.fields?.url || node.url || '')
    if (!url) return <span key={key}>{children}</span>
    const isLocal = (url.startsWith('/') && !url.startsWith('//')) || url.startsWith('#')
    return <a key={key} href={url} {...(node.fields?.newTab && !isLocal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>
  }
  return <span key={key}>{children}</span>
}

export function RichContent({ value, text }: { value?: unknown; text?: string }) {
  const root = (value as { root?: RichNode } | null)?.root
  return <div className="rich-content">{root?.children?.length ? root.children.map(render) : text?.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
}
