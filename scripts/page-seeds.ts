import type { SerializedHeadingNode, SerializedLinkNode, SerializedListNode, SerializedParagraphNode, SerializedTextNode } from '@payloadcms/richtext-lexical'
import type { Payload } from 'payload'
import type { Page } from '../src/payload-types'

const element = { format: '' as const, indent: 0, version: 1, direction: null }

function text(value: string): SerializedTextNode {
  return { type: 'text', version: 1, text: value, detail: 0, format: 0, mode: 'normal', style: '' }
}

function paragraph(...parts: (string | SerializedLinkNode)[]): SerializedParagraphNode {
  return { ...element, type: 'paragraph', textFormat: 0, textStyle: '', children: parts.map(part => typeof part === 'string' ? text(part) : part) }
}

function heading(value: string): SerializedHeadingNode {
  return { ...element, type: 'heading', tag: 'h2', children: [text(value)] }
}

function bulletedList(items: string[]): SerializedListNode {
  return {
    ...element,
    type: 'list',
    tag: 'ul',
    listType: 'bullet',
    start: 1,
    children: items.map((item, index) => ({ ...element, type: 'listitem', value: index + 1, children: [text(item)] })),
  }
}

function link(label: string, url: string): SerializedLinkNode {
  return { ...element, type: 'link', version: 3, fields: { linkType: 'custom', newTab: false, url }, children: [text(label)] }
}

function body(children: Page['body']['root']['children']): Page['body'] {
  return { root: { ...element, type: 'root', children } }
}

export const initialPages = [
  {
    slug: 'donate', title: 'Donate to Pets4Luv',
    body: body([
      heading('How your donation helps'),
      paragraph('Any donation, whether it’s money or supplies, helps us care for the cats and dogs at Pets4Luv. Your gifts help cover veterinary costs and provide food, litter, cleaning supplies, and toys. They also help us provide separate housing for cats and quarantine space for dogs.'),
      heading('Supplies needed'),
      paragraph('We appreciate donations of supplies and gift cards from pet, office supply, and general retailers.'),
      bulletedList([
        'Food and treats: canned dog food, Fancy Feast wet food for cats and kittens, and dog and cat treats.',
        'Pet equipment: cat carriers, martingale or limited-slip collars from small to extra-large, and 6-foot leashes.',
        'Toys and grooming: dog and cat toys, pet wipes, nail clippers, and flea combs. Please skip catnip and rawhide.',
        'Cleaning and office supplies: 13-gallon and 40-gallon or larger trash bags, paper towels, sponges, dog waste bags, printer paper, and can openers.',
      ]),
      paragraph('Pets4Luv is a member of BISSELL Pet Foundation’s Partners for Pets program.'),
      paragraph('For our current wish list, to arrange a supply drop-off, or to request a donation receipt, email ', link('info@pets4luv.org', 'mailto:info@pets4luv.org'), '.'),
    ]),
  },
  {
    slug: 'contact', title: 'Contact Pets4Luv',
    body: body([
      paragraph('We are glad you are here. Whether you are hoping to meet an animal or find a way to help, you can start by exploring our adoption and volunteering information.'),
      paragraph('Approved contact details will be added here when they are ready. Please check back for ways to get in touch.'),
    ]),
  },
  {
    slug: 'about', title: 'About Pets4Luv',
    body: body([
      heading('Welcome'),
      paragraph('Pets4Luv Foundation is a registered 501(c)(3) nonprofit animal rescue. Your donations are tax-deductible. Our organization has no paid board members. They are all here for the love of animals. All of our funding comes from private donations. We receive no government funding to run our organization. Pets4Luv is a no-kill rescue, which means we will never euthanize an animal for space.'),
      paragraph('Pets4Luv is an all-breed dog and cat rescue. Our primary focus is on the rescue, rehabilitation, and rehoming of animals that are injured, ill, or disabled, animals with other special needs, and senior animals. We care for animals with both temporary and lifelong conditions. We also focus on educating the public about companion animal illnesses, medical conditions, and disabilities to help dispel misconceptions about these conditions. We hope that making this information more readily available to the public will increase the chances of animals with special needs finding loving forever families.'),
      heading('Our mission'),
      paragraph('Volunteers run Pets4Luv entirely, and we have no paid employees. Our goal is to make rescue and adoption more visible on Long Island. By bringing rescue into busy public places, we can reach people who might never visit a shelter and show them another way to find their next dog or cat. We also want prospective owners to understand the risks of poor breeding and inadequate care in the pet trade.'),
      paragraph('By making this information easy to find, we hope to correct misconceptions that allow outdated and inhumane practices and laws to continue.'),
      heading('Other areas of focus'),
      bulletedList([
        'Maintain a fund to help pet owners who cannot afford veterinary care and prevent unnecessary euthanasia.',
        'Provide pet food to owners in need.',
        'Teach the public about pet care, animal well-being, and the responsibilities of pet ownership.',
        'Bring veterinarians and emergency animal hospitals together to make care more affordable.',
        'Offer young people classes on caring for and interacting with animals.',
        'Use trap-neuter-return (TNR) to manage the size and health of community cat populations.',
      ]),
      heading('Contact us'),
      paragraph('If you have questions about Pets4Luv, call ', link('(516) 860-7057', 'tel:+15168607057'), ' or email ', link('info@pets4luv.org', 'mailto:info@pets4luv.org'), '.'),
      paragraph('Looking for your next companion? ', link('Meet our available animals', '/animals'), '.'),
    ]),
  },
] as const

/** Only create absent pages. Existing published content and unpublished drafts are always preserved. */
export async function seedMissingPages(payload: Payload): Promise<string[]> {
  const created: string[] = []
  for (const page of initialPages) {
    const existing = await payload.find({ collection: 'pages', where: { slug: { equals: page.slug } }, draft: true, limit: 1, depth: 0 })
    if (existing.docs.length) continue
    await payload.create({ collection: 'pages', data: { ...page, _status: 'published' } })
    created.push(page.slug)
  }
  return created
}
