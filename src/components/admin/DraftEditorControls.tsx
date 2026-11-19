'use client'

import { PublishButton, SaveDraftButton, useDocumentInfo, useFormModified } from '@payloadcms/ui'

export function DraftEditorPublishButton({ draftLabel }: { draftLabel: string }) {
  const { hasPublishedDoc, unpublishedVersionCount } = useDocumentInfo()
  const modified = useFormModified()
  const hasDraft = !hasPublishedDoc || unpublishedVersionCount > 0

  if (!modified && !hasDraft) return null
  return <PublishButton label={hasDraft ? draftLabel : undefined} />
}

export function DraftEditorSaveDraftButton() {
  const modified = useFormModified()
  return modified ? <SaveDraftButton /> : null
}
