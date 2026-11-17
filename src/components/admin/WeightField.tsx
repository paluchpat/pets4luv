'use client'

import { NumberField } from '@payloadcms/ui'
import type { NumberFieldClientProps } from 'payload'
import { useEffect, useRef } from 'react'

/** Keep Payload's native field behavior while allowing any decimal precision. */
export function WeightField(props: NumberFieldClientProps) {
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const input = wrapper.current?.querySelector<HTMLInputElement>('input[type="number"]')
    // Payload's step config accepts only numbers; HTML also supports "any".
    input?.setAttribute('step', 'any')
    input?.setAttribute('inputmode', 'decimal')
    function numbersOnly(event: InputEvent) {
      if (event.data && /[^0-9.]/.test(event.data)) event.preventDefault()
    }
    input?.addEventListener('beforeinput', numbersOnly)
    return () => input?.removeEventListener('beforeinput', numbersOnly)
  }, [])
  return <div ref={wrapper} style={{ display: 'contents' }}><NumberField {...props} /></div>
}
