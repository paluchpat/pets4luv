import type { SerializedHeadingNode, SerializedLinkNode, SerializedListNode, SerializedParagraphNode, SerializedTextNode } from '@payloadcms/richtext-lexical'
import type { Page } from '../src/payload-types'

const element = { format: '' as const, indent: 0, version: 1, direction: null }

function text(value: string): SerializedTextNode {
  return { type: 'text', version: 1, text: value, detail: 0, format: 0, mode: 'normal', style: '' }
}

export function link(label: string, url: string): SerializedLinkNode {
  return { ...element, type: 'link', version: 3, fields: { linkType: 'custom', newTab: false, url }, children: [text(label)] }
}

export function paragraph(...parts: (string | SerializedLinkNode)[]): SerializedParagraphNode {
  return { ...element, type: 'paragraph', textFormat: 0, textStyle: '', children: parts.map(part => typeof part === 'string' ? text(part) : part) }
}

export function orderedList(items: string[]): SerializedListNode {
  return {
    ...element,
    type: 'list',
    tag: 'ol',
    listType: 'number',
    start: 1,
    children: items.map((item, index) => ({ ...element, type: 'listitem', value: index + 1, children: [text(item)] })),
  }
}

export function heading(value: string): SerializedHeadingNode {
  return { ...element, type: 'heading', tag: 'h2', children: [text(value)] }
}

export function body(...children: (SerializedHeadingNode | SerializedParagraphNode | SerializedListNode)[]): Page['body'] {
  return { root: { ...element, type: 'root', children } }
}

export function bulletedList(items: string[]): SerializedListNode {
  return { ...orderedList(items), tag: 'ul', listType: 'bullet' }
}
