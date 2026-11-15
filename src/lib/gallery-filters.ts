export const emptyGalleryFilters = {
  q: '',
  species: '',
  ageGroup: '',
  size: '',
  sex: '',
  goodWithDogs: false,
  goodWithCats: false,
  goodWithChildren: false,
  page: 1,
}

export type GalleryFilters = typeof emptyGalleryFilters

export function galleryHref(filters: GalleryFilters, page = filters.page) {
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(filters)) {
    if (name !== 'page' && value) query.set(name, String(value))
  }
  if (page > 1) query.set('page', String(page))
  return query.size ? `/animals?${query}` : '/animals'
}
