import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-pets4luv-featured-preview', '1')
  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: '/preview/featured/:token' }
