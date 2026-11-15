import type { SerializedLinkNode, SerializedParagraphNode, SerializedTextNode } from '@payloadcms/richtext-lexical'
import { isDeepStrictEqual } from 'node:util'
import type { Payload } from 'payload'
import type { Knowledge } from '../src/payload-types'

const element = { format: '' as const, indent: 0, version: 1, direction: null }

function text(value: string): SerializedTextNode {
  return { type: 'text', version: 1, text: value, detail: 0, format: 0, mode: 'normal', style: '' }
}

function link(label: string, url: string): SerializedLinkNode {
  return { ...element, type: 'link', version: 3, fields: { linkType: 'custom', newTab: false, url }, children: [text(label)] }
}

function paragraph(...parts: (string | SerializedLinkNode)[]): SerializedParagraphNode {
  return { ...element, type: 'paragraph', textFormat: 0, textStyle: '', children: parts.map(part => typeof part === 'string' ? text(part) : part) }
}

function body(...children: SerializedParagraphNode[]): Knowledge['body'] {
  return { root: { ...element, type: 'root', children } }
}

const demo = {
  title: 'A little of your time. A lot of love.',
  source: 'Fictional demonstration fixture',
  reviewer: 'Demo content',
  reviewedAt: '2026-11-07',
  body: body(paragraph('This fictional demonstration illustrates where approved volunteering information will appear. A real rescue may need help with animal care, transport, events and foster support. Ask the organization about its current opportunities, training and age requirements.')),
}

const volunteering = {
  slug: 'volunteering',
  category: 'volunteering',
  title: 'Volunteer with Pets4Luv',
  body: body(
    paragraph('Spend time with the animals in our care and experience the love and companionship they bring. Knowing you’ve helped save a life is a feeling that stays with you. These dogs and cats will give that love right back and show you just how special they are.'),
    paragraph('Pets4Luv is a registered 501(c)(3) nonprofit rescue powered entirely by volunteers who care deeply about our dogs and cats. Volunteers feed and socialize the animals and help with their daily care. Our goal is to give each animal a second chance and help them find their forever family.'),
    paragraph('To join us, email ', link('info@pets4luv.org', 'mailto:info@pets4luv.org'), ' or call ', link('(516) 860-7057', 'tel:+15168607057'), ' to ask for a volunteer application.'),
  ),
  source: 'https://www.pets4luv.org/volunteering',
  reviewer: null,
  reviewedAt: null,
  _status: 'published',
} as const

function isUneditedDemo(article: Knowledge) {
  return article._status === 'published'
    && article.slug === volunteering.slug
    && article.category === volunteering.category
    && article.title === demo.title
    && article.source === demo.source
    && article.reviewer === demo.reviewer
    && Date.parse(article.reviewedAt ?? '') === Date.parse(demo.reviewedAt)
    && isDeepStrictEqual(article.body, demo.body)
}

export async function seedVolunteering(payload: Payload): Promise<'created' | 'updated' | 'preserved'> {
  const lookup = { collection: 'knowledge', where: { slug: { equals: volunteering.slug } }, limit: 1, depth: 0 } as const
  const { docs: [stored] } = await payload.find({ ...lookup, draft: false })
  if (!stored) {
    const { docs } = await payload.find({ ...lookup, draft: true })
    if (docs.length) return 'preserved'
    await payload.create({ collection: 'knowledge', data: volunteering })
    return 'created'
  }

  if (!isUneditedDemo(stored)) return 'preserved'
  // Look up the latest version by ID in case a staff draft changed the slug.
  const latest = await payload.findByID({ collection: 'knowledge', id: stored.id, draft: true, depth: 0 })
  if (!isUneditedDemo(latest)) return 'preserved'
  await payload.update({ collection: 'knowledge', id: stored.id, draft: false, data: volunteering })
  return 'updated'
}
