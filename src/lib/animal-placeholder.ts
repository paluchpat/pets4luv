export const animalPlaceholder = {
  src: '/images/animal-photo-placeholder.webp',
  filename: 'animal-photo-placeholder.webp',
  alt: 'Photo coming soon — heart and paw illustration',
} as const

/** Keep each animal's image independent so replacing it never changes another profile. */
export async function loadAnimalPlaceholder(api: string, request: typeof fetch = fetch): Promise<string | number> {
  const image = await request(animalPlaceholder.src)
  if (!image.ok) throw new Error('Could not load the placeholder image. Please try again.')
  const body = new FormData()
  body.append('file', await image.blob(), animalPlaceholder.filename)
  body.append('_payload', JSON.stringify({ alt: animalPlaceholder.alt }))
  const uploaded = await request(`${api}/media`, { method: 'POST', credentials: 'same-origin', body })
  if (!uploaded.ok) throw new Error('Could not add the placeholder. Please try again.')
  const { doc } = await uploaded.json()
  if (typeof doc?.id !== 'number' && typeof doc?.id !== 'string') throw new Error('The placeholder was not saved. Please try again.')
  return doc.id
}
