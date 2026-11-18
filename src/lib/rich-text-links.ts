import type { Payload } from 'payload'
import { publicPageHref } from './main-menu'

type Reference = { relationTo: 'pages' | 'animals'; id: number }

function reference(node: unknown): Reference | null {
  if (!node || typeof node !== 'object') return null
  const { type, fields } = node as { type?: string; fields?: { linkType?: string; doc?: { relationTo?: string; value?: unknown } } }
  if (type !== 'link' || fields?.linkType !== 'internal') return null
  const doc = fields.doc
  if (doc?.relationTo !== 'pages' && doc?.relationTo !== 'animals') return null
  const value = doc.value && typeof doc.value === 'object' ? (doc.value as { id?: unknown }).id : doc.value
  const id = typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? { relationTo: doc.relationTo, id } : null
}

/** Resolve current published slugs in at most one lookup per linked collection. */
export async function resolveRichTextLinks<T>(payload: Pick<Payload, 'find'>, value: T): Promise<T> {
  const references = new Map<string, Reference>()
  let hasInternalLinks = false
  function collect(node: unknown) {
    if (!node || typeof node !== 'object') return
    const record = node as { type?: string; fields?: { linkType?: string } }
    if (record.type === 'link' && record.fields?.linkType === 'internal') hasInternalLinks = true
    const ref = reference(node)
    if (ref) references.set(`${ref.relationTo}:${ref.id}`, ref)
    for (const child of Object.values(node)) collect(child)
  }
  collect(value)
  if (!hasInternalLinks) return value

  const destinations = new Map<string, string>()
  await Promise.all((['pages', 'animals'] as const).map(async collection => {
    const ids = [...references.values()].filter(ref => ref.relationTo === collection).map(ref => ref.id)
    if (!ids.length) return
    const { docs } = await payload.find({
      collection, overrideAccess: false, draft: false, depth: 0, pagination: false,
      where: { and: [{ id: { in: ids } }, { _status: { equals: 'published' } }] },
      select: { slug: true, _status: true },
    })
    for (const doc of docs) {
      if (doc._status !== 'published' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug)) continue
      destinations.set(`${collection}:${doc.id}`, collection === 'pages' ? publicPageHref(doc.slug) : `/animals/${doc.slug}`)
    }
  }))

  function resolve(node: any): any {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map(resolve)
    const ref = reference(node)
    if (node.type === 'link' && node.fields?.linkType === 'internal') {
      const { doc: _doc, ...fields } = node.fields
      return { ...node, fields: { ...fields, linkType: 'custom', url: ref ? destinations.get(`${ref.relationTo}:${ref.id}`) || '' : '' }, children: node.children?.map(resolve) }
    }
    return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, resolve(child)]))
  }
  return resolve(value)
}
