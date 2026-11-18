import type { MetadataRoute } from 'next'
import { publicSiteOrigin } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/media/file/'],
      disallow: ['/admin', '/api/'],
    },
    ...(publicSiteOrigin && { sitemap: new URL('/sitemap.xml', publicSiteOrigin).href }),
  }
}
