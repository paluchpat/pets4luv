'use client'

import { useRowLabel } from '@payloadcms/ui'

/** Row headings start a sentence; the array's action noun stays lowercase. */
export function ArrayRowLabel({ label = 'Row' }: { label?: string }) {
  const { rowNumber = 0 } = useRowLabel()
  return <span>{label} {String(rowNumber + 1).padStart(2, '0')}</span>
}
