'use client'

import { useRowLabel } from '@payloadcms/ui'
import type { MenuRecord } from '../../lib/main-menu'

export function MenuRowLabel() {
  const { data } = useRowLabel<MenuRecord>()
  return <span>{data.label || 'New menu item'}{data.linkType === 'submenu' && <small> · {data.children?.length || 0} links</small>}</span>
}
