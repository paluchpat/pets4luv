'use client'

import { PublishButton, SaveDraftButton, useDocumentInfo, useFormModified } from '@payloadcms/ui'

export function AnimalEditorPublishButton() {
  const { hasPublishedDoc, unpublishedVersionCount } = useDocumentInfo()
  const modified = useFormModified()
  const hasDraft = !hasPublishedDoc || unpublishedVersionCount > 0

  if (!modified && !hasDraft) return null
  return <PublishButton label={hasDraft ? 'Publish animal' : undefined} />
}

export function AnimalEditorSaveDraftButton() {
  const modified = useFormModified()
  return modified ? <SaveDraftButton /> : null
}
