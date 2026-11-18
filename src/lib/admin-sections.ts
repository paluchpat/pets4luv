/** Website editing order, shared by the sidebar and dashboard. */
export const websiteAdminSections = [
  { label: 'Animals', entities: [{ type: 'collection', slug: 'animals', label: 'Animals', singular: 'animal' }] },
  { label: 'Homepage', entities: [
    { type: 'global', slug: 'homepage-intro', label: 'Intro' },
    { type: 'global', slug: 'homepage', label: 'Featured animals' },
  ] },
  { label: 'Pages', entities: [{ type: 'collection', slug: 'pages', label: 'Pages', singular: 'page' }] },
  { label: 'Settings', entities: [
    { type: 'global', slug: 'website-settings', label: 'Website settings' },
    { type: 'global', slug: 'main-menu', label: 'Main menu' },
    { type: 'collection', slug: 'users', label: 'Users', singular: 'user' },
  ] },
] as const
