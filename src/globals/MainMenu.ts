import type { Field, GlobalConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'
import type { MenuRecord } from '../lib/main-menu'
import { builtInMenuPages, validateMenuLabel, validateMenuUrl } from '../lib/main-menu'

type ValidationContext = { siblingData?: Partial<MenuRecord & { enabled: boolean }> }

const trim = ({ value }: { value?: unknown }) => typeof value === 'string' ? value.trim() : value
function linkFields(submenu = false): Field[] {
  return [
    { name: 'label', label: 'Menu label', type: 'text', maxLength: 80, validate: (value: unknown, { siblingData }: ValidationContext) => siblingData?.enabled === false ? true : validateMenuLabel(value), hooks: { beforeValidate: [trim] } },
    { name: 'linkType', label: 'Link to', type: 'select', required: true, defaultValue: 'page', options: [
      { label: 'Page from Pages', value: 'page' },
      { label: 'Built-in page', value: 'builtIn' },
      { label: 'Custom link', value: 'custom' },
      ...(submenu ? [{ label: 'Submenu', value: 'submenu' }] : []),
    ] },
    { name: 'page', label: 'Choose a page', type: 'relationship', relationTo: 'pages', filterOptions: { _status: { equals: 'published' } },
      validate: (value: unknown, { siblingData }: ValidationContext) => siblingData?.enabled === false || siblingData?.linkType !== 'page' || value ? true : 'Choose a published page.',
      admin: { condition: (_, siblingData) => siblingData?.linkType === 'page', description: 'Publish a page in Pages first, then select it here. Its menu address follows later slug changes automatically.' } },
    { name: 'builtIn', label: 'Choose a built-in page', type: 'select', options: builtInMenuPages.map(({ value, label }) => ({ value, label })),
      validate: (value: unknown, { siblingData }: ValidationContext) => siblingData?.enabled === false || siblingData?.linkType !== 'builtIn' || builtInMenuPages.some(page => page.value === value) ? true : 'Choose a built-in page.',
      admin: { condition: (_, siblingData) => siblingData?.linkType === 'builtIn' } },
    { name: 'url', label: 'Link address', type: 'text', maxLength: 2048,
      validate: (value: unknown, { siblingData }: ValidationContext) => siblingData?.enabled === false || siblingData?.linkType !== 'custom' ? true : validateMenuUrl(value),
      hooks: { beforeValidate: [trim] }, admin: { condition: (_, siblingData) => siblingData?.linkType === 'custom', description: 'For example /animals, https://example.org, mailto:name@example.org, or tel:+15165550100.' } },
    { name: 'newTab', label: 'Open in a new tab', type: 'checkbox', defaultValue: false, admin: { condition: (_, siblingData) => siblingData?.linkType !== 'submenu' } },
    { name: 'showInFooter', label: 'Also show in the footer', type: 'checkbox', defaultValue: false, admin: { condition: (_, siblingData) => siblingData?.linkType !== 'submenu', description: 'Uses the same label and destination in both places.' } },
  ]
}

export const MainMenu: GlobalConfig = {
  slug: 'main-menu', label: 'Main Menu',
  access: { read: publishedOrStaff, update: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, max: 30 },
  admin: {
    group: false,
    description: 'Add, remove, and drag menu items to reorder them. Submenus group related links. Save a draft to preview, then publish to update desktop and mobile navigation.',
    preview: () => '/api/preview?path=/',
    livePreview: { url: '/api/preview?path=/' },
  },
  fields: [
    { name: 'items', label: 'Menu items', type: 'array', maxRows: 12,
      labels: { singular: 'Menu item', plural: 'Menu items' },
      admin: { initCollapsed: true, components: { RowLabel: './components/admin/MenuRowLabel#MenuRowLabel' } },
      fields: [
        ...linkFields(true),
        { name: 'children', label: 'Submenu links', type: 'array', maxRows: 16,
          labels: { singular: 'Submenu link', plural: 'Submenu links' },
          validate: (value: unknown, { siblingData }: ValidationContext) => siblingData?.linkType !== 'submenu' || (Array.isArray(value) && value.length > 0) ? true : 'Add at least one link to this submenu.',
          admin: { condition: (_, siblingData) => siblingData?.linkType === 'submenu', initCollapsed: true, components: { RowLabel: './components/admin/MenuRowLabel#MenuRowLabel' } },
          fields: linkFields(),
        },
      ],
    },
    { name: 'highlightedButton', label: 'Call-to-action menu button', type: 'group', fields: [
      { name: 'enabled', label: 'Show the call-to-action menu button', type: 'checkbox', defaultValue: true },
      { type: 'collapsible', label: 'Button details', admin: { condition: (_, siblingData) => siblingData?.enabled !== false }, fields: linkFields() },
    ] },
  ],
}
