import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { draftMode, headers } from 'next/headers'

import { defaultGallerySort, type GallerySort } from './gallery-filters'
import { animalDTO, buildAnimalWhere, richTextToText, type AnimalDTO, type AnimalFilters, type HomepageDTO, type RichText } from './public-content'
export * from './public-content'

const galleryPageSize = 12
const gallerySortFields: Record<GallerySort, string[]> = {
  'name-asc': ['name', 'id'],
  'name-desc': ['-name', 'id'],
  'age-asc': ['-estimatedBirthDate', 'name', 'id'],
  'age-desc': ['estimatedBirthDate', 'name', 'id'],
  newest: ['-createdAt', 'name', 'id'],
  oldest: ['createdAt', 'name', 'id'],
}

export async function searchAnimals(filters: AnimalFilters = {}, sort: GallerySort = defaultGallerySort) {
  const payload = await getPayload({ config })
  const page = Math.min(10000, Math.max(1, Math.floor(Number(filters.page) || 1)))
  const query = { collection: 'animals', overrideAccess: false, draft: false, where: buildAnimalWhere(filters) } as const
  const sortFields = gallerySortFields[sort]

  if (sort === 'age-asc' || sort === 'age-desc') {
    const { docs: matches } = await payload.find({
      ...query,
      depth: 0,
      pagination: false,
      select: { estimatedBirthDate: true },
      sort: sortFields,
    })
    // Keep undated animals at the end in both directions before selecting the page.
    const dated = matches.filter(animal => animal.estimatedBirthDate)
    const undated = matches.filter(animal => !animal.estimatedBirthDate)
    const offset = (page - 1) * galleryPageSize
    const ids = [...dated, ...undated].slice(offset, offset + galleryPageSize).map(animal => animal.id)
    const pagination = { totalDocs: matches.length, totalPages: Math.ceil(matches.length / galleryPageSize), page }

    if (!ids.length) return { ...pagination, docs: [] }

    const result = await payload.find({
      ...query,
      depth: 2,
      pagination: false,
      limit: galleryPageSize,
      where: { and: [query.where, { id: { in: ids } }] },
    })
    const byID = new Map(result.docs.map(doc => [doc.id, doc]))
    const docs = ids.flatMap(id => {
      const doc = byID.get(id)
      return doc ? [animalDTO(doc)] : []
    })
    return { ...pagination, docs }
  }

  const result = await payload.find({ ...query, depth: 2, limit: galleryPageSize, page, sort: sortFields })
  return { docs: result.docs.map(doc => animalDTO(doc)), totalDocs: result.totalDocs, totalPages: result.totalPages, page: result.page || 1 }
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
  const byID = new Map(result.docs.map((doc: any) => [String(doc.id), animalDTO(doc, 'uncropped')]))
  return { heading: homepage.heading || 'A few faces to fall for', intro: homepage.intro || null, introText: richTextToText(homepage.intro), featuredAnimals: ids.map((id: any) => byID.get(String(id))).filter(Boolean) as AnimalDTO[] }
}

export async function getKnowledge(slug: string) {
  if (slug === 'care') return null
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
