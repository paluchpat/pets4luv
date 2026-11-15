import { draftMode } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || !['admin', 'editor'].includes(String(user.role))) return Response.json({ error: 'Staff login required for preview.' }, { status: 401 })
  const path = new URL(request.url).searchParams.get('path') || '/'
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return Response.json({ error: 'Invalid preview path.' }, { status: 400 })
  ;(await draftMode()).enable()
  return Response.redirect(new URL(path, request.url), 307)
}
