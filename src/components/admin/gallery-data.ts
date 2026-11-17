import type { Payload, TypedUser } from 'payload'
import { adminAnimalCard, type AdminAnimalCard } from '../../lib/admin-animal-gallery'

/** Only authenticated staff can obtain unpublished gallery cards. */
export async function loadAdminGalleryCards(payload: Payload, user: TypedUser | null | undefined, ids?: number[]): Promise<AdminAnimalCard[]> {
  if (!user || !['admin', 'editor'].includes(String(user.role)) || ids?.length === 0) return []
  const [animals, homepage] = await Promise.all([
    payload.find({ collection: 'animals', overrideAccess: false, user, draft: true, depth: 1,
      ...(ids ? { where: { id: { in: ids } }, pagination: false } : { limit: 3, sort: '-updatedAt' }),
      select: { name: true, species: true, sex: true, status: true, ageGroup: true, estimatedBirthDate: true, photos: true, updatedAt: true, _status: true },
    }),
    payload.findGlobal({ slug: 'homepage', overrideAccess: false, user, draft: false, depth: 0, select: { featuredAnimals: true, _status: true } }),
  ])
  const selected = animals.docs.map(doc => doc.id)
  const published = selected.length ? await payload.find({ collection: 'animals', overrideAccess: false, user, draft: false, depth: 0, pagination: false,
    where: { and: [{ id: { in: selected } }, { _status: { equals: 'published' } }] }, select: { _status: true, status: true },
  }) : { docs: [] }
  const publishedIDs = new Set(published.docs.map(doc => String(doc.id)))
  const availableIDs = new Set(published.docs.filter(doc => doc.status === 'available').map(doc => String(doc.id)))
  const featuredIDs = new Set(homepage._status === 'published' ? (homepage.featuredAnimals || []).map(row => String(typeof row.animal === 'object' ? row.animal.id : row.animal)).filter(id => availableIDs.has(id)) : [])
  const cards = animals.docs.map(doc => adminAnimalCard(doc, publishedIDs, featuredIDs))
  if (!ids) return cards
  const byID = new Map(cards.map(card => [card.id, card]))
  return ids.flatMap(id => { const card = byID.get(id); return card ? [card] : [] })
}
