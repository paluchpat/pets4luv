import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'
import { isStaff } from '../access'

export async function discardFeaturedDraft(req: PayloadRequest) {
  if (!req.user) return Response.json({ message: 'Sign in to discard a draft.' }, { status: 401 })
  if (!await isStaff({ req })) return Response.json({ message: 'You cannot edit featured animals.' }, { status: 403 })
  if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return Response.json({ message: 'Send the saved draft timestamp.' }, { status: 415 })
  }
  const body = await req.json?.().catch(() => null)
  if (typeof body?.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt))) {
    return Response.json({ message: 'Reload Featured animals and try again.' }, { status: 400 })
  }

  const { payload } = req
  const userID = req.user.id
  const started = await initTransaction(req)
  try {
    const options = { slug: 'homepage', req, overrideAccess: false, depth: 0 } as const
    const live = await payload.findGlobal({ ...options, draft: false, includeLockStatus: true })
    if (live._status !== 'published' || !live.updatedAt) {
      return Response.json({ message: 'There is no published version to return to.' }, { status: 409 })
    }
    const locked = live as typeof live & { _isLocked?: boolean; _userEditing?: { id: number } | number | null }
    const lockOwner = typeof locked._userEditing === 'object' ? locked._userEditing?.id : locked._userEditing
    if (locked._isLocked && lockOwner !== userID) {
      return Response.json({ message: 'Another editor is working on Featured animals.' }, { status: 423 })
    }

    const draft = await payload.findGlobal({ ...options, draft: true })
    if (draft._status !== 'draft' || draft.updatedAt !== body.updatedAt) {
      return Response.json({ message: 'The draft changed. Reload Featured animals and review it before discarding.' }, { status: 409 })
    }

    // Match the active-draft criteria used by Payload when opening a global.
    await payload.db.deleteVersions({
      globalSlug: 'homepage', req,
      where: { and: [
        { 'version._status': { equals: 'draft' } },
        { or: [{ updatedAt: { greater_than: live.updatedAt } }, { latest: { equals: true } }] },
      ] },
    })
    const { docs: [publishedVersion] } = await payload.db.findGlobalVersions({
      global: 'homepage', req, limit: 1, sort: ['-updatedAt', '-id'],
      where: { 'version._status': { equals: 'published' } },
    })
    if (publishedVersion) {
      await payload.db.updateGlobalVersion({
        global: 'homepage', id: publishedVersion.id, req, returning: false,
        versionData: { latest: true, updatedAt: publishedVersion.updatedAt, version: publishedVersion.version },
      })
    }
    if (started) await commitTransaction(req)
    return Response.json({ message: 'Draft discarded.' })
  } finally {
    if (started) await killTransaction(req)
  }
}
