import { timingSafeEqual } from 'node:crypto'
import config from '@payload-config'
import { getPayload } from 'payload'
import { publishCatministratorDraft, reviewCatministratorAnimal, saveCatministratorDraft, undoFeaturedPublication } from '@/lib/catministrator/drafts'
import { linkedTelegramEditor } from '@/lib/catministrator/editors'
import { AnimalNameError, DraftRequestError } from '@/lib/catministrator/requests'

function hasServiceKey(request: Request, key: string) {
  const expected = Buffer.from('Bearer ' + key)
  const actual = Buffer.from(request.headers.get('authorization') || '')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function POST(request: Request) {
  const key = process.env.CATMINISTRATOR_CMS_KEY
  if (!key || key.length < 32 || !hasServiceKey(request, key)) return new Response(null, { status: 404 })
  const text = await request.text()
  if (text.length > 16000) return new Response(null, { status: 413 })
  const body = await Promise.resolve().then(() => JSON.parse(text)).catch(() => null)
  if (!body || !Number.isSafeInteger(body.id) || body.id < 1 || !Number.isSafeInteger(body.date) ||
    !['linked', 'save', 'review-animal', 'publish', 'undo'].includes(body.action)) return new Response(null, { status: 400 })
  try {
    const payload = await getPayload({ config })
    const editor = await linkedTelegramEditor(payload, body.id, body.date)
    if (body.action === 'linked') return Response.json(Boolean(editor))
    if (!editor) throw new DraftRequestError('This Telegram account can no longer edit the CMS.')
    if (body.action === 'save') {
      if (body.featuredVersion != null && typeof body.featuredVersion !== 'string') return new Response(null, { status: 400 })
      return Response.json(await saveCatministratorDraft(payload, editor, body.draft, body.featuredVersion))
    }
    if (body.action === 'review-animal') {
      if (typeof body.animal !== 'string' || !body.animal.trim() || body.animal.length > 160) return new Response(null, { status: 400 })
      return Response.json(await reviewCatministratorAnimal(payload, editor, body.animal.trim()))
    }
    if (typeof body.token !== 'string') return new Response(null, { status: 400 })
    const apply = body.action === 'undo' ? undoFeaturedPublication : publishCatministratorDraft
    return Response.json(await apply(payload, editor, body.token))
  } catch (error) {
    if (error instanceof AnimalNameError) return Response.json({ message: error.message, nameIssue: error.issue }, { status: 422 })
    if (error instanceof DraftRequestError) return Response.json({ message: error.message }, { status: 422 })
    console.error('The Catministrator CMS operation failed.')
    return new Response(null, { status: 500 })
  }
}
