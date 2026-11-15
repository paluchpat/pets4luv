import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { draftMode, headers } from 'next/headers'

import { animalDTO, buildAnimalWhere, richTextToText, type AnimalDTO, type AnimalFilters, type HomepageDTO, type RichText } from './public-content'
export * from './public-content'

export async function searchAnimals(filters: AnimalFilters = {}) {
  const payload = await getPayload({ config })
  const page = Math.min(10000, Math.max(1, Math.floor(Number(filters.page) || 1)))
  const result = await payload.find({ collection: 'animals', overrideAccess: false, draft: false, depth: 2, where: buildAnimalWhere(filters), limit: 12, page, sort: 'name' })
  return { docs: result.docs.map(animalDTO), totalDocs: result.totalDocs, totalPages: result.totalPages, page: result.page || 1 }
}

export async function getAnimal(slug: string): Promise<AnimalDTO | null> {
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'animals', overrideAccess: false, draft: false, depth: 2, where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] }, limit: 1 })
  return result.docs[0] ? animalDTO(result.docs[0]) : null
}

async function previewActor(payload: Awaited<ReturnType<typeof getPayload>>) {
  try {
    if (!(await draftMode()).isEnabled) return null
    const { user } = await payload.auth({ headers: await headers() })
    return user && ['admin', 'editor'].includes(String(user.role)) ? user : null
  } catch { return null }
}

export async function getHomepage(): Promise<HomepageDTO> {
  const payload = await getPayload({ config })
  const user = await previewActor(payload)
  const homepage = await payload.findGlobal({ slug: 'homepage', overrideAccess: false, draft: Boolean(user), user: user || undefined, depth: 0 }) as any
  const ids = (homepage.featuredAnimals || []).map((row: any) => typeof row.animal === 'object' ? row.animal?.id : row.animal).filter(Boolean)
  const result = ids.length ? await payload.find({ collection: 'animals', overrideAccess: false, draft: false, depth: 2, limit: 6, where: { and: [{ id: { in: ids } }, { _status: { equals: 'published' } }, { status: { equals: 'available' } }] } }) : { docs: [] }
  const byID = new Map(result.docs.map((doc: any) => [String(doc.id), animalDTO(doc)]))
  return { heading: homepage.heading || 'A few faces to fall for', intro: homepage.intro || null, introText: richTextToText(homepage.intro), featuredAnimals: ids.map((id: any) => byID.get(String(id))).filter(Boolean) as AnimalDTO[] }
}

export async function getKnowledge(slug: string) {
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'knowledge', overrideAccess: false, draft: false, depth: 0, where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] }, limit: 1 })
  const doc = result.docs[0] as any
  return doc ? { title: doc.title as string, slug: doc.slug as string, category: doc.category as string, body: doc.body as RichText, bodyText: richTextToText(doc.body), reviewedAt: doc.reviewedAt as string | null } : null
}

export async function getPage(slug: string) {
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'pages', overrideAccess: false, draft: false, depth: 0, where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] }, limit: 1 })
  const doc = result.docs[0]
  return doc ? { title: doc.title, slug: doc.slug, body: doc.body as RichText, bodyText: richTextToText(doc.body) } : null
}
