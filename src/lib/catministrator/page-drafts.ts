import type { PayloadRequest } from 'payload'
import type { DraftReceipt } from './drafts'
import { DraftRequestError, type DraftRequest } from './requests'

export async function savePageTextDraft(req: PayloadRequest, request: Extract<DraftRequest, { action: 'page-text' }>): Promise<DraftReceipt> {
  const { payload } = req
  const options = { req, collection: 'pages', draft: true, overrideAccess: false, depth: 0 } as const
  const key = request.page.toLowerCase()
  const { docs } = await payload.find({
    ...options, pagination: false,
    where: { or: [{ slug: { equals: key } }, { title: { like: request.page } }] },
  })
  const pages = docs.filter(page => page.slug === key || page.title.toLowerCase() === key)
  if (pages.length !== 1) throw new DraftRequestError('Use the page’s exact CMS title or slug so I can identify it.')
  const [page] = pages
  if (request.before === request.after) throw new DraftRequestError('Send the text you want to replace it with.')
  const body = structuredClone(page.body)
  let occurrences = 0
  function replace(value: unknown) {
    if (!value || typeof value !== 'object') return
    const node = value as { type?: string; text?: string; children?: unknown[] }
    if (node.type === 'text' && typeof node.text === 'string') {
      const parts = node.text.split(request.before)
      occurrences += parts.length - 1
      node.text = parts.join(request.after)
    }
    if (Array.isArray(node.children)) node.children.forEach(replace)
  }
  replace(body?.root)
  if (occurrences !== 1) {
    throw new DraftRequestError(occurrences
      ? 'That text appears more than once. Quote a longer passage that occurs once.'
      : 'I couldn’t match that exact text in one formatted section. Copy the wording from the CMS and try again.')
  }
  await payload.update({ ...options, id: page.id, overrideLock: false, data: { body, _status: 'draft' } })
  return { message: `Page draft saved for ${page.title}.`, path: '/admin/collections/pages/' + page.id, changed: true }
}
