'use client'

import { Dropzone, useAuth, useBulkUpload, useFieldPath, useForm, useFormFields, useFormProcessing, useModal } from '@payloadcms/ui'
import { ImagePlus } from 'lucide-react'
import type { UploadFieldClientProps } from 'payload'
import { useRef, useState } from 'react'

/** Choose a file first, then use Payload's photo details and upload screen. */
export function PhotoUploadControls({ field, path: initialPath, readOnly }: UploadFieldClientProps) {
  // Array rows keep their component when reordered; context supplies the current path.
  const currentPath = useFieldPath()
  const path = currentPath || initialPath
  const fieldState = useFormFields(([fields]) => fields[path])
  const { permissions } = useAuth()
  const { dispatchFields, setModified } = useForm()
  const processing = useFormProcessing()
  const { openModal } = useModal()
  const { drawerSlug, setCollectionSlug, setInitialFiles, setMaxFiles, setOnSuccess, setSelectableCollections } = useBulkUpload()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const canCreate = !readOnly && field.admin?.allowCreate !== false && permissions?.collections?.media?.create

  if (fieldState?.value || !canCreate) return null

  function chooseFile(files: FileList) {
    if (processing || !files.length) return
    const file = files[0]
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPG, PNG, or WebP photo.')
      return
    }
    setError('')
    // A photo row holds one image, even when several files are dropped at once.
    const selection = new DataTransfer()
    selection.items.add(file)
    setInitialFiles(selection.files)
    setCollectionSlug('media')
    setSelectableCollections(null)
    setMaxFiles(1)
    // Payload clears this callback when the drawer closes; register on every open.
    setOnSuccess((uploaded) => {
      const id = uploaded[0]?.doc.id
      if (typeof id === 'string' || typeof id === 'number') {
        dispatchFields({ type: 'UPDATE', path, value: id })
        setModified(true)
      }
    })
    openModal(drawerSlug)
  }

  return <div className="cms-photo-upload">
    <Dropzone className="cms-photo-upload__dropzone" disabled={processing} multipleFiles={false} onChange={chooseFile}>
      <ImagePlus size={28} aria-hidden="true" />
      <strong>Drag and drop a photo here</strong>
      <span className="cms-photo-upload__hint">JPG, PNG, or WebP</span>
      <button type="button" className="cms-photo-upload__select" disabled={processing} onClick={() => input.current?.click()}>Select a file</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={processing} aria-label="Select a photo file" onChange={(event) => {
        if (event.target.files) chooseFile(event.target.files)
        event.target.value = ''
      }} />
    </Dropzone>
    {error && <p className="cms-photo-upload__error" role="alert">{error}</p>}
  </div>
}
