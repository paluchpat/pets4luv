import { DefaultListView } from '@payloadcms/ui'
import type { ListViewServerProps } from 'payload'
import { loadAdminGalleryCards } from './gallery-data'
import { AnimalGalleryListClient } from './AnimalGalleryListClient'

/** Reuse Payload's list query, permissions, pagination, and relationship-picker behavior. */
export async function AnimalGalleryList(props: ListViewServerProps) {
  const { payload, permissions, user, data } = props
  if (!user || !['admin', 'editor'].includes(String(user.role)) || !permissions?.collections?.animals?.read) return null
  const ids = (data.docs || []).map((doc: { id: number }) => doc.id)
  const cards = await loadAdminGalleryCards(payload, user, ids)
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
