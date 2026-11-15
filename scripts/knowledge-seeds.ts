import { isDeepStrictEqual } from 'node:util'
import type { SerializedLinkNode, SerializedListNode, SerializedParagraphNode, SerializedTextNode } from '@payloadcms/richtext-lexical'
import type { Payload } from 'payload'
import type { Knowledge } from '../src/payload-types'

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

export function body(...children: (SerializedParagraphNode | SerializedListNode)[]): Knowledge['body'] {
  return { root: { ...element, type: 'root', children } }
}

type KnowledgeSeed = Pick<Knowledge, 'body' | 'category' | 'slug' | 'title' | 'source' | 'reviewer' | 'reviewedAt'> & { _status: 'published' }
type DemoContent = Pick<Knowledge, 'body' | 'title' | 'source' | 'reviewer' | 'reviewedAt'>

function isUneditedDemo(article: Knowledge, data: KnowledgeSeed, demo: DemoContent) {
  return article._status === 'published'
    && article.slug === data.slug
    && article.category === data.category
    && article.title === demo.title
    && article.source === demo.source
    && article.reviewer === demo.reviewer
    && Date.parse(article.reviewedAt ?? '') === Date.parse(demo.reviewedAt ?? '')
    && isDeepStrictEqual(article.body, demo.body)
}

export async function seedKnowledgeArticle(payload: Payload, data: KnowledgeSeed, demo?: DemoContent): Promise<'created' | 'updated' | 'preserved'> {
  const lookup = { collection: 'knowledge', where: { slug: { equals: data.slug } }, limit: 1, depth: 0 } as const
  const { docs: [stored] } = await payload.find({ ...lookup, draft: false })
  if (!stored) {
    const { docs } = await payload.find({ ...lookup, draft: true })
    if (docs.length) return 'preserved'
    await payload.create({ collection: 'knowledge', data })
    return 'created'
  }

  if (!demo || !isUneditedDemo(stored, data, demo)) return 'preserved'
  // Look up the latest version by ID in case a staff draft changed the slug.
  const latest = await payload.findByID({ collection: 'knowledge', id: stored.id, draft: true, depth: 0 })
  if (!isUneditedDemo(latest, data, demo)) return 'preserved'
  await payload.update({ collection: 'knowledge', id: stored.id, draft: false, data })
  return 'updated'
}
