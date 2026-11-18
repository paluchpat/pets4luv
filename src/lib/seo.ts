import type { Metadata } from 'next'
import { richTextToText, type RichText } from './public-content'
import { phoneHref, type WebsiteSettings } from './website-settings'

export const siteName = 'Pets4Luv Foundation'
export const homeTitle = `${siteName} | Cat & Dog Rescue in Freeport, NY`
export const homeDescription = 'Pets4Luv Foundation is a volunteer-run, no-kill cat and dog rescue in Freeport, NY. Meet adoptable pets, volunteer, or support their care.'
export const noIndex = { index: false, follow: true } as const

function siteOrigin(value: string | undefined, httpsOnly = true): URL | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    const allowedProtocol = url.protocol === 'https:' || (!httpsOnly && url.protocol === 'http:')
    if (allowedProtocol && url.href === url.origin + '/') return url
  } catch {
    return undefined
  }
}

const vercelPreview = Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')
export const publicSiteOrigin = process.env.NODE_ENV === 'production' && !vercelPreview
  ? siteOrigin(process.env.SITE_URL)
  : undefined

const vercelHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
export const metadataBase = publicSiteOrigin
  ?? (vercelHost ? siteOrigin(`https://${vercelHost}`) : undefined)
  ?? siteOrigin(process.env.NEXT_PUBLIC_SERVER_URL, false)
  ?? new URL('http://localhost:3000')

const defaultImage = {
  url: '/images/pets4luv-share.jpg',
  width: 1200,
  height: 630,
  alt: 'A golden dog and tabby cat resting together on a soft blanket',
}

export function shortDescription(value: string, fallback: string): string {
  const text = value.replace(/\s+/g, ' ').trim() || fallback
  if (text.length <= 160) return text
  const excerpt = text.slice(0, 156).replace(/\s+\S*$/, '').trimEnd()
  return (excerpt || text.slice(0, 156)) + '…'
}

export function pageDescription(body: RichText | null | undefined, fallback: string): string {
  for (const node of body?.root.children ?? []) {
    if (node && typeof node === 'object' && 'type' in node && node.type === 'paragraph') {
      const text = richTextToText(node).trim()
      if (text) return shortDescription(text, fallback)
    }
  }
  return fallback
}

type PageMetadata = {
  title: string
  description: string
  path: string
  image?: { url: string; alt: string } | null
  indexable?: boolean
}

export function pageMetadata({ title, description, path, image, indexable = true }: PageMetadata): Metadata {
  const socialTitle = path === '/' ? title : `${title} · Pets4Luv`
  const images = image ? [image, defaultImage] : [defaultImage]
  return {
    title: path === '/' ? { absolute: title } : title,
    description,
    ...(publicSiteOrigin && { alternates: { canonical: path } }),
    ...(!indexable && { robots: noIndex }),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName,
      title: socialTitle,
      description,
      url: path,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [images[0]],
    },
  }
}

export function homepageStructuredData(settings: WebsiteSettings) {
  const url = metadataBase.href
  const organizationId = url + '#organization'
  const sameAs = [...new Set([settings.instagramUrl, settings.facebookUrl, settings.tiktokUrl].filter(Boolean))]
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        url,
        name: siteName,
        alternateName: 'Pets4Luv',
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: siteName,
        url,
        description: homeDescription,
        logo: new URL('/images/logo.png', metadataBase).href,
        address: settings.address,
        telephone: phoneHref(settings.phone).slice(4),
        email: settings.emailAddress,
        ...(sameAs.length && { sameAs }),
      },
    ],
  }
}
