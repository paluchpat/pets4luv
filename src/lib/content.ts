import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { draftMode, headers } from 'next/headers'
import { cache } from 'react'
import { resolveRichTextLinks } from './rich-text-links'
import { mainMenuDTO, menuPageIDs, type MainMenuDTO } from './main-menu'
import { applyWebsiteSettings, websiteSettingsDTO, type WebsiteSettings } from './website-settings'

import { featuredAnimalEligibility, featuredAnimalIds, featuredAnimalLimit } from './featured-animals'
import { orderAnimalsByAge } from './animal-age'
import { defaultGallerySort, type GallerySort } from './gallery-filters'
import { animalDTO, animalProfileDTO, buildAnimalWhere, homepageIntroDTO, richTextToText, type AnimalProfileDTO, type AnimalFilters, type HomepageDTO } from './public-content'
export * from './public-content'

const galleryPageSize = 12
const gallerySortFields: Record<Exclude<GallerySort, 'age-asc' | 'age-desc'>, string[]> = {
  'name-asc': ['name', 'id'],
  'name-desc': ['-name', 'id'],
  newest: ['-createdAt', 'name', 'id'],
  oldest: ['createdAt', 'name', 'id'],
}

export async function searchAnimals(filters: AnimalFilters = {}, sort: GallerySort = defaultGallerySort) {
  const payload = await getPayload({ config })
  const settings = await getWebsiteSettings()
  const page = Math.min(10000, Math.max(1, Math.floor(Number(filters.page) || 1)))
  const query = { collection: 'animals', overrideAccess: false, draft: false, where: buildAnimalWhere(filters) } as const

  if (sort === 'age-asc' || sort === 'age-desc') {
    const { docs: matches } = await payload.find({
      ...query,
      depth: 0,
      pagination: false,
      select: { estimatedBirthDate: true, ageGroup: true },
      sort: ['name', 'id'],
    })
    const offset = (page - 1) * galleryPageSize
    const ids = orderAnimalsByAge(matches, sort === 'age-desc')
      .slice(offset, offset + galleryPageSize).map(animal => animal.id)
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
      return doc ? [applyWebsiteSettings(animalDTO(doc, 'uncropped'), settings)] : []
    })
    return { ...pagination, docs }
  }

  const result = await payload.find({ ...query, depth: 2, limit: galleryPageSize, page, sort: gallerySortFields[sort] })
  return { docs: result.docs.map(doc => applyWebsiteSettings(animalDTO(doc, 'uncropped'), settings)), totalDocs: result.totalDocs, totalPages: result.totalPages, page: result.page || 1 }
}

export const getAnimal = cache(async (slug: string): Promise<AnimalProfileDTO | null> => {
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'animals', overrideAccess: false, draft: false, depth: 2, where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] }, limit: 1 })
  return result.docs[0] ? applyWebsiteSettings(animalProfileDTO(result.docs[0]), await getWebsiteSettings()) : null
})

async function previewActor(payload: Awaited<ReturnType<typeof getPayload>>) {
  if (!(await draftMode()).isEnabled) return null
  const { user } = await payload.auth({ headers: await headers() })
  return user && ['admin', 'editor'].includes(String(user.role)) ? user : null
}

export const getMainMenu = cache(async (publishedOnly = false): Promise<MainMenuDTO> => {
  const payload = await getPayload({ config })
  const user = publishedOnly ? null : await previewActor(payload)
  const menu = await payload.findGlobal({ slug: 'main-menu', overrideAccess: false, draft: Boolean(user), user: user || undefined, depth: 0 })
  const ids = menuPageIDs(menu)
  const pages = ids.length ? await payload.find({
    collection: 'pages', overrideAccess: false, draft: false, depth: 0, pagination: false,
    where: { and: [{ id: { in: ids } }, { _status: { equals: 'published' } }] },
    select: { slug: true, _status: true },
  }) : { docs: [] }
  return mainMenuDTO(applyWebsiteSettings(menu, await getWebsiteSettings(publishedOnly)), pages.docs, Boolean(user))
})

export const getWebsiteSettings = cache(async (publishedOnly = false): Promise<WebsiteSettings> => {
  const payload = await getPayload({ config })
  const user = publishedOnly ? null : await previewActor(payload)
  const settings = await payload.findGlobal({ slug: 'website-settings', overrideAccess: false, draft: Boolean(user), user: user || undefined, depth: 0 })
  return websiteSettingsDTO(settings, Boolean(user))
})

export async function getHomepage(previewFeaturedIDs?: number[]): Promise<HomepageDTO> {
  const publishedOnly = previewFeaturedIDs !== undefined
  const payload = await getPayload({ config })
  const user = publishedOnly ? null : await previewActor(payload)
  const [homepage, foundationIntro, settings] = await Promise.all([
    payload.findGlobal({ slug: 'homepage', overrideAccess: false, draft: Boolean(user), user: user || undefined, depth: 0 }),
    payload.findGlobal({ slug: 'homepage-intro', overrideAccess: false, draft: Boolean(user), user: user || undefined, depth: 0 }),
    getWebsiteSettings(publishedOnly),
  ])
  const ids = previewFeaturedIDs ?? featuredAnimalIds(homepage.featuredAnimals)
  const result = ids.length ? await payload.find({ collection: 'animals', overrideAccess: false, draft: false, depth: 2, limit: featuredAnimalLimit, where: { and: [{ id: { in: ids } }, featuredAnimalEligibility] } }) : { docs: [] }
  const byID = new Map(result.docs.map(doc => [doc.id, applyWebsiteSettings(animalDTO(doc, 'uncropped'), settings)]))
  const foundation = homepageIntroDTO(foundationIntro, Boolean(user))
  const [resolvedBody, resolvedIntro] = await Promise.all([resolveRichTextLinks(payload, foundation.body), resolveRichTextLinks(payload, homepage.intro || null)])
  const body = applyWebsiteSettings(resolvedBody, settings)
  const intro = applyWebsiteSettings(resolvedIntro, settings)
  return { foundationIntro: { ...foundation, body, bodyText: richTextToText(body) }, heading: homepage.heading || 'A few faces to fall for', intro, introText: richTextToText(intro), featuredAnimals: ids.flatMap(id => byID.get(id) ?? []) }
}

const getContentPage = cache(async (slug: string) => {
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'pages', overrideAccess: false, draft: false, depth: 0, where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] }, limit: 1 })
  const doc = result.docs[0]
  if (!doc) return null
  const body = applyWebsiteSettings(await resolveRichTextLinks(payload, doc.body), await getWebsiteSettings())
  return { title: doc.title, slug: doc.slug, body, bodyText: richTextToText(body) }
})

export function getInformationPage(slug: string) {
  return slug === 'adoption' || slug === 'volunteering' ? getContentPage(slug) : null
}

export function getPage(slug: string) {
  return slug === 'adoption' || slug === 'volunteering' ? null : getContentPage(slug)
}
