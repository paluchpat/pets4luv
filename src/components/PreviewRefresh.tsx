'use client'

import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function PreviewRefresh() {
  const router = useRouter()
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  return origin ? <RefreshRouteOnSave refresh={() => router.refresh()} serverURL={origin} /> : null
}
