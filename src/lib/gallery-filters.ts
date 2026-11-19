export const galleryResultsHeadingId = 'gallery-results-heading'
export const gallerySearchMaxLength = 200

export const gallerySortOptions = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'age-asc', label: 'Age (youngest first)' },
  { value: 'age-desc', label: 'Age (oldest first)' },
  { value: 'newest', label: 'Newest addition' },
  { value: 'oldest', label: 'Oldest addition' },
] as const

export type GallerySort = (typeof gallerySortOptions)[number]['value']

export const defaultGallerySort: GallerySort = 'newest'

export function parseGallerySort(value: string | string[] | undefined): GallerySort {
  return gallerySortOptions.find(option => option.value === value)?.value ?? defaultGallerySort
}

export const emptyGalleryFilters = {
  q: '',
  species: '',
  ageGroup: '',
  size: '',
  gender: '',
  color: '',
  goodWithDogs: false,
  goodWithCats: false,
  goodWithChildren: false,
  page: 1,
}

export type GalleryFilters = typeof emptyGalleryFilters & { sort: GallerySort }

export function galleryHref(filters: GalleryFilters, page = filters.page) {
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(filters)) {
    if (name === 'page' || (name === 'sort' && value === defaultGallerySort)) continue
    if (value) query.set(name, String(value))
  }
  if (page > 1) query.set('page', String(page))
  return query.size ? `/animals?${query}` : '/animals'
}
