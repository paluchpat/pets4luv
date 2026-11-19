// Payload persists the collection's previous default sort in CMS URLs and preferences.
// Use that value for Featured, with a separate sort value for Recently updated.
export const defaultAdminAnimalSort = '-updatedAt'

export const adminAnimalSortOptions = [
  { value: defaultAdminAnimalSort, label: 'Featured + Recent' },
  { value: '-updatedAt,-id', label: 'Recently updated' },
  { value: '-createdAt', label: 'Newest addition' },
  { value: 'createdAt', label: 'Oldest addition' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: '-name', label: 'Name (Z–A)' },
]
