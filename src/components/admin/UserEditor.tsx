'use client'

import { SaveButton, useDocumentInfo, useDocumentTitle, useFormModified } from '@payloadcms/ui'
import { useEffect } from 'react'
import { telegramHelp } from '../../lib/admin-sections'

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
  const modified = useFormModified()
  if (id && !modified) return null
  return <SaveButton label={id ? 'Save changes' : 'Create user'} />
}

export function TelegramIDDescription() {
  return <div className="field-description">
    <span>Ask the user to send /start to the Telegram bot <strong>{telegramHelp.username}</strong> and share the ID it returns. Clear this field and save to revoke access.</span>
  </div>
}
