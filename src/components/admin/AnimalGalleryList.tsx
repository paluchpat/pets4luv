import { DefaultListView } from '@payloadcms/ui'
import type { ListViewServerProps, Where } from 'payload'
import { parse } from 'qs-esm'
import { loadAdminGalleryPageCards } from './gallery-data'
import { AnimalGalleryListClient } from './AnimalGalleryListClient'

/** Reuse Payload's list query, permissions, pagination, and relationship-picker behavior. */
export async function AnimalGalleryList(props: ListViewServerProps) {
  const { payload, permissions, user, data } = props
  if (!user || !['admin', 'editor'].includes(String(user.role)) || !permissions?.collections?.animals?.read) return null
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(props.searchParams || {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item)
  }
  // Parse the same bracketed filter syntax as Payload's native list query.
  const query = parse(params.toString(), { depth: 10 })
  const where = query.where && typeof query.where === 'object' && !Array.isArray(query.where) ? query.where as Where : props.queryPreset?.where || undefined
  const cards = await loadAdminGalleryPageCards(payload, user, {
    where, search: typeof query.search === 'string' ? query.search : undefined,
    sort: props.listPreferences?.sort || props.collectionConfig.defaultSort,
    page: data.page || 1, limit: props.limit,
  })
  // Keep the native list inside relationship-selection drawers; its selection callbacks are essential.
  const nativeList = <DefaultListView collectionSlug={props.collectionSlug} columnState={props.columnState}
    hasCreatePermission={props.hasCreatePermission} hasDeletePermission={props.hasDeletePermission} hasTrashPermission={props.hasTrashPermission}
    newDocumentURL={props.newDocumentURL} viewType={props.viewType} Table={props.Table}
    enableRowSelections={props.enableRowSelections} disableBulkDelete={props.disableBulkDelete} disableBulkEdit={props.disableBulkEdit}
    disableQueryPresets={props.disableQueryPresets} renderedFilters={props.renderedFilters} resolvedFilterOptions={props.resolvedFilterOptions}
    queryPreset={props.queryPreset} queryPresetPermissions={props.queryPresetPermissions} Description={props.Description}
  />
  return <AnimalGalleryListClient cards={cards} canCreate={Boolean(props.hasCreatePermission)} nativeList={nativeList} />
}
