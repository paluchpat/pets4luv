import type { Payload } from 'payload'

function body(paragraphs: string[]) {
  return { root: { type: 'root', format: '' as const, indent: 0, version: 1, direction: null, children: paragraphs.map((text) => ({ type: 'paragraph', format: '' as const, indent: 0, version: 1, direction: null, textFormat: 0, textStyle: '', children: [{ type: 'text', version: 1, text, detail: 0, format: 0, mode: 'normal', style: '' }] })) } }
}

export const initialPages = [
  {
    slug: 'donate', title: 'Donate to Pets4Luv',
    paragraphs: [
      'Every animal deserves a safe place, a full bowl and kind care. Your support can help Pets4Luv provide everyday food, comfort and care while animals wait for their next chapter.',
      'There are many ways to make a difference, from helping with useful supplies to supporting the work that keeps animals comfortable and cared for.',
    ],
  },
  {
    slug: 'contact', title: 'Contact Pets4Luv',
    paragraphs: [
      'We are glad you are here. Whether you are hoping to meet an animal or find a way to help, you can start by exploring our adoption and volunteering information.',
      'Approved contact details will be added here when they are ready. Please check back for ways to get in touch.',
    ],
  },
] as const

/** Only create absent pages. Existing published content and unpublished drafts are always preserved. */
export async function seedMissingPages(payload: Payload): Promise<string[]> {
  const created: string[] = []
  for (const page of initialPages) {
    const existing = await payload.find({ collection: 'pages', where: { slug: { equals: page.slug } }, draft: true, limit: 1, depth: 0 })
    if (existing.docs.length) continue
    await payload.create({ collection: 'pages', data: { title: page.title, slug: page.slug, body: body([...page.paragraphs]), _status: 'published' } })
    created.push(page.slug)
  }
  return created
}
