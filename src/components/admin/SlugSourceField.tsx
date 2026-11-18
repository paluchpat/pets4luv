'use client'

import { TextField, useForm, useFormInitializing, useFormProcessing } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'
import type { FocusEvent } from 'react'
import { fillEmptySlug } from '../../lib/slug'

/** Generate after the whole title/name is entered, then leave the slug alone. */
export function SlugSourceField(props: TextFieldClientProps) {
  const { dispatchFields, getDataByPath, setModified } = useForm()
  const initializing = useFormInitializing()
  const processing = useFormProcessing()

  function fillSlug(event: FocusEvent<HTMLDivElement>) {
    if (props.readOnly || props.field.admin?.readOnly || initializing || processing || !(event.target instanceof HTMLInputElement)) return
    const current = getDataByPath('slug')
    const next = fillEmptySlug(current, event.target.value)
    if (typeof next === 'string' && next && next !== current) {
      dispatchFields({ type: 'UPDATE', path: 'slug', value: next, disableFormData: false })
      setModified(true)
    }
  }

  return <div className="field-type cms-slug-source" onBlurCapture={fillSlug}><TextField {...props} /></div>
}
