'use client'

import { ConfirmationModal, PopupList, UnpublishButton, toast, useConfig, useDocumentInfo, useForm, useModal } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'

const modal = 'discard-featured-draft'

export function FeaturedDraftMenu() {
  const { data, hasPublishedDoc, hasSavePermission } = useDocumentInfo()
  const { config } = useConfig()
  const { setModified } = useForm()
  const { openModal } = useModal()

  if (!hasSavePermission || !hasPublishedDoc || data?._status !== 'draft' || typeof data.updatedAt !== 'string') {
    return <UnpublishButton />
  }

  const updatedAt = data.updatedAt
  async function discard() {
    const url = formatAdminURL({ apiRoute: config.routes.api, path: '/globals/homepage/discard-draft' })
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt }),
      })
      if (!response.ok) {
        const { message } = await response.json()
        toast.error(message || 'Could not discard the draft. Try again.')
        return
      }
      setModified(false)
      window.location.reload()
    } catch {
      toast.error('Could not discard the draft. Try again.')
    }
  }

  return <>
    <PopupList.Button id="action-discard-featured-draft" onClick={() => openModal(modal)}>
      Discard draft
    </PopupList.Button>
    <ConfirmationModal
      modalSlug={modal}
      heading="Discard featured animals draft?"
      body="This removes unpublished changes and returns the editor to the published version."
      confirmLabel="Discard draft"
      confirmingLabel="Discarding…"
      onConfirm={discard}
    />
  </>
}
