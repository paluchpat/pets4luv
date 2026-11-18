'use client'

import { SaveButton, useDocumentInfo, useDocumentTitle } from '@payloadcms/ui'
import { useEffect } from 'react'

/** Keep the create view descriptive while existing users retain their email title. */
export function UserEditorTitle() {
  const { id, isInitializing } = useDocumentInfo()
  const { title, setDocumentTitle } = useDocumentTitle()

  useEffect(() => {
    if (id || isInitializing || title === 'Add user') return
    // Run after Payload initializes its own title for the empty document.
    const frame = requestAnimationFrame(() => setDocumentTitle('Add user'))
    return () => cancelAnimationFrame(frame)
  }, [id, isInitializing, title, setDocumentTitle])

  return null
}

export function UserEditorSaveButton() {
  const { id } = useDocumentInfo()
  return <SaveButton label={id ? 'Save changes' : 'Create user'} />
}
