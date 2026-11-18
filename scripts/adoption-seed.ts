import { isDeepStrictEqual } from 'node:util'
import type { Payload } from 'payload'
import { body, heading, link, orderedList, paragraph, seedKnowledgeArticle } from './knowledge-seeds'
import { richTextToText } from '../src/lib/public-content'
import type { Knowledge } from '../src/payload-types'

const demo = {
  title: 'Find your new best friend',
  source: 'Fictional demonstration fixture',
  reviewer: 'Demo content',
  reviewedAt: '2026-11-07',
  body: body(paragraph('This is a fictional local demonstration, not an operating rescue. In a real adoption process, the rescue will discuss your household, help you meet an animal and explain its approved adoption policies. Contact the rescue directly for current fees, application requirements and availability.')),
}

const catSource = 'https://www.pets4luv.org/Cat-Adoption-Information'
const dogSource = 'https://www.pets4luv.org/Dog-Adoption-Information'
const published = { category: 'adoption', reviewer: null, reviewedAt: null, _status: 'published' } as const

const speciesSections = [
  {
    slug: 'cat-adoption',
    title: 'Cat adoption',
    paragraphs: [
      paragraph('Cats adopted through Pets4Luv live indoors as companions. Declawing and devocalization are permitted only when medically necessary.'),
      paragraph('Cat adoption includes rabies and FVRCP vaccinations, testing for FIV, FeLV, and heartworm, deworming, spay or neuter surgery, and a microchip.'),
    ],
  },
  {
    slug: 'dog-adoption',
    title: 'Dog adoption',
    paragraphs: [
      paragraph('Dogs adopted through Pets4Luv live indoors as companions. Devocalization, ear cropping, and tail docking are permitted only when medically necessary. Pets4Luv encourages obedience training and advises against shock or prong collars.'),
      paragraph('Pools and other water features must have safeguards that keep dogs out of the water. Pets4Luv generally requires an enclosed area with a physical fence. It does not accept electronic fences and considers homes without fencing individually.'),
      paragraph('Dog adoption includes age-appropriate vaccinations, heartworm and fecal testing, deworming, spay or neuter surgery, and a microchip.'),
    ],
  },
]

const adoption = {
  ...published,
  slug: 'adoption',
  title: 'How adoption works',
  source: `${catSource}, ${dogSource}`,
  body: body(
    paragraph('Adoption usually takes 3 to 7 days after Pets4Luv receives your signed application. Email ', link('{{emailAddress}}', '{{emailHref}}'), ' or call ', link('{{phone}}', '{{phoneHref}}'), ' for the current application.'),
    orderedList([
      'Complete the application. Include any required addenda, three personal references who aren’t relatives, and one veterinary reference.',
      'Prepare for a home check. Pets must be allowed at your address. If you rent, provide your landlord’s contact information. Pets4Luv checks that the home is safe for the animal.',
      'Meet the animal. All household members meet the animal, and any pets already at home have at least one introduction. Existing pets must be spayed or neutered and up to date on vaccines.',
    ]),
    paragraph('Pets4Luv generally spays or neuters animals before adoption. If surgery must be delayed for medical reasons, sign a spay or neuter agreement and arrange an appointment with the veterinarian Pets4Luv designates.'),
    paragraph('Pets4Luv may follow up by phone or with a home visit. Contact the rescue for the current payment, medical support, and refund terms in the Adoption Agreement.'),
    ...speciesSections.flatMap(section => [heading(section.title), ...section.paragraphs]),
  ),
}

export async function seedAdoption(payload: Payload) {
  return { adoption: await seedKnowledgeArticle(payload, adoption, demo) }
}

const knowledgeLookup = { collection: 'knowledge', depth: 0 } as const

async function assertCurrent(payload: Payload, article: Knowledge) {
  // Read by ID because a staff draft may have changed the slug.
  const latest = await payload.findByID({ ...knowledgeLookup, id: article.id, draft: true, disableErrors: true })
  if (article._status === 'draft' || latest?._status === 'draft') {
    throw new Error(`Publish or discard the draft for "${article.slug}" before consolidating adoption.`)
  }
  if (article._status !== 'published' || !isDeepStrictEqual(latest, article)) {
    throw new Error(`The adoption article "${article.slug}" changed during consolidation.`)
  }
}

async function findAdoptionArticle(payload: Payload, slug: string) {
  const lookup = { ...knowledgeLookup, where: { slug: { equals: slug } }, limit: 1 }
  const { docs: [article] } = await payload.find({ ...lookup, draft: false })
  if (article) {
    await assertCurrent(payload, article)
    return article
  }
  const { docs } = await payload.find({ ...lookup, draft: true })
  if (docs.length) throw new Error(`Publish or discard the draft for "${slug}" before consolidating adoption.`)
}

export async function consolidateAdoption(payload: Payload) {
  const overview = await findAdoptionArticle(payload, adoption.slug)
  if (!overview) throw new Error('The published adoption overview is missing.')
  const legacy = await Promise.all(speciesSections.map(section => findAdoptionArticle(payload, section.slug)))
  const children = overview.body.root.children
  const headings = children.flatMap((node, index) => {
    if (node.type !== 'heading') return []
    const title = richTextToText(node)
    return speciesSections.some(section => section.title === title) ? [{ index, tag: node.tag, title }] : []
  })

  let expectedBody = overview.body
  const updated = headings.length === 0
  if (updated) {
    const [cat, dog] = legacy
    if (!cat || !dog) throw new Error('Both published species articles are required to combine their copy.')
    expectedBody = {
      ...overview.body,
      root: {
        ...overview.body.root,
        children: [
          ...children,
          heading(speciesSections[0].title),
          ...cat.body.root.children,
          heading(speciesSections[1].title),
          ...dog.body.root.children,
        ],
      },
    }
    await assertCurrent(payload, overview)
    await payload.update({ ...knowledgeLookup, id: overview.id, draft: false, data: { body: expectedBody } })
  } else {
    if (headings.length !== speciesSections.length || headings.some(({ tag, title }, index) => tag !== 'h2' || title !== speciesSections[index].title)) {
      throw new Error('The adoption overview already has unexpected species headings.')
    }
    for (const [index, article] of legacy.entries()) {
      const existing = children.slice(headings[index].index + 1, headings[index + 1]?.index)
      if (!existing.length || (article && !isDeepStrictEqual(existing, article.body.root.children))) {
        throw new Error(`The published overview has different copy for "${speciesSections[index].slug}".`)
      }
    }
  }

  const verified = await payload.findByID({ ...knowledgeLookup, id: overview.id, draft: false })
  if (verified.slug !== adoption.slug || verified._status !== 'published' || !isDeepStrictEqual(verified.body, expectedBody)) {
    throw new Error('The combined adoption body could not be verified.')
  }

  const deleted: string[] = []
  for (const article of legacy) {
    if (!article) continue
    await assertCurrent(payload, verified)
    await assertCurrent(payload, article)
    await payload.delete({ ...knowledgeLookup, id: article.id })
    deleted.push(article.slug)
  }
  return { updated, deleted }
}
