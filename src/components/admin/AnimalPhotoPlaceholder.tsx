'use client'

import { Button, useAuth, useConfig, useFieldPath, useForm, useFormFields, useFormProcessing } from '@payloadcms/ui'
import type { ArrayFieldClientProps } from 'payload'
import { useRef, useState } from 'react'
import { loadAnimalPlaceholder } from '../../lib/animal-placeholder'

/** Offer a fallback only while this animal has no assigned images. */
export function AnimalPhotoPlaceholder({ field, path: initialPath, readOnly, schemaPath }: ArrayFieldClientProps) {
  const currentPath = useFieldPath()
  const path = currentPath || initialPath || field.name
  const hasPhoto = useFormFields(([fields]) => Object.entries(fields).some(([key, state]) =>
    key.startsWith(path + '.') && key.endsWith('.photo') && Boolean(state.value)))
  const { permissions } = useAuth()
  const { config: { routes: { api } } } = useConfig()
  const { addFieldRow, dispatchFields, getDataByPath, setModified } = useForm()
  const processing = useFormProcessing()
  const adding = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (hasPhoto || readOnly || field.admin?.readOnly || !permissions?.collections?.media?.create) return null

  async function usePlaceholder() {
    if (processing || adding.current) return
    adding.current = true
    setBusy(true)
    setError('')
    try {
      const id = await loadAnimalPlaceholder(api)
      const photos = getDataByPath(path) as { photo?: unknown }[] | undefined
      // An editor may have added a photo while the image was being prepared.
      if (photos?.some(row => row.photo)) return
      if (photos?.length) {
        dispatchFields({ type: 'UPDATE', path: `${path}.0.photo`, value: id })
        setModified(true)
      } else {
        addFieldRow({ path, schemaPath: schemaPath || field.name, subFieldState: { photo: { value: id, initialValue: null, valid: true } } })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the placeholder. Please try again.')
    } finally {
      adding.current = false
      setBusy(false)
    }
  }

  return <>
    <Button className="cms-use-placeholder" buttonStyle="secondary" type="button" disabled={processing || busy} onClick={usePlaceholder}>
      {busy ? 'Adding placeholder…' : 'Use placeholder'}
    </Button>
    {error && <p className="cms-photo-upload__error" role="alert">{error}</p>}
  </>
}
