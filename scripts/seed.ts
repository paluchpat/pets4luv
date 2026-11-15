import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { seedMissingPages } from './page-seeds'

const payload = await getPayload({ config })
function richText(text: string) {
  return { root: { type: 'root', format: '' as const, indent: 0, version: 1, direction: null, children: [{ type: 'paragraph', format: '' as const, indent: 0, version: 1, direction: null, textFormat: 0, textStyle: '', children: [{ type: 'text', version: 1, text, detail: 0, format: 0, mode: 'normal', style: '' }] }] } }
}

const demo = [
  { name: 'Luna', slug: 'luna', species: 'cat', sex: 'female', ageGroup: 'young', size: 'small', breed: 'Domestic shorthair', photo: 'luna', summary: 'A little curious. A lot lovable.', description: 'Luna is a playful little explorer who loves a sunny windowsill and a gentle game. This fictional profile is here to demonstrate the adoption experience.', dogs: 'unknown', cats: 'yes', children: 'conditional', date: '2025-04-01' },
  { name: 'Milo', slug: 'milo', species: 'dog', sex: 'male', ageGroup: 'adult', size: 'medium', breed: 'Mixed breed', photo: 'milo', summary: 'Your next adventure buddy.', description: 'Milo is happiest on a walk with a kind companion. He would love room to explore and people to come home to. This is a fictional demonstration profile.', dogs: 'yes', cats: 'unknown', children: 'yes', date: '2022-05-01' },
  { name: 'Olive', slug: 'olive', species: 'cat', sex: 'female', ageGroup: 'adult', size: 'small', breed: 'Domestic shorthair', photo: 'olive', summary: 'A soft spot for the quiet life.', description: 'Olive enjoys slow mornings and a cozy spot beside someone she trusts. This fictional profile is for the local demonstration only.', dogs: 'no', cats: 'conditional', children: 'unknown', date: '2021-03-01' },
  { name: 'Jasper', slug: 'jasper', species: 'dog', sex: 'male', ageGroup: 'senior', size: 'large', breed: 'Mixed breed', photo: 'jasper', summary: 'An old soul with plenty of love to give.', description: 'Jasper is a fictional senior dog fixture for trying gallery filters.', dogs: 'conditional', cats: 'unknown', children: 'yes', date: '2015-02-01' },
  { name: 'Poppy', slug: 'poppy', species: 'cat', sex: 'female', ageGroup: 'baby', size: 'small', breed: 'Domestic shorthair', photo: 'poppy', summary: 'Tiny paws, big plans.', description: 'Poppy is a fictional kitten fixture for trying gallery filters.', dogs: 'unknown', cats: 'yes', children: 'unknown', date: '2026-07-01' },
  { name: 'Scout', slug: 'scout', species: 'dog', sex: 'female', ageGroup: 'young', size: 'small', breed: 'Mixed breed', photo: 'scout', summary: 'Ready to learn and ready to love.', description: 'Scout is a fictional young dog fixture for trying gallery filters.', dogs: 'yes', cats: 'no', children: 'conditional', date: '2025-08-01' },
] as const
const media: Record<string, number> = {}
for (const name of new Set(demo.map(({ photo }) => photo))) {
  const alt = `${name[0].toUpperCase() + name.slice(1)}, fictional demo animal`
  const found = await payload.find({ collection: 'media', where: { alt: { equals: alt } }, limit: 1 })
  media[name] = found.docs[0]?.id || (await payload.create({ collection: 'media', data: { alt }, filePath: path.resolve('public/images', `${name}.png`) })).id
}
const animals: Record<string, number> = {}
for (const animal of demo) {
  const found = await payload.find({ collection: 'animals', where: { slug: { equals: animal.slug } }, limit: 1, draft: true })
  if (found.docs[0]) { animals[animal.slug] = found.docs[0].id; continue }
  const { photo, dogs, cats, children, date, ...fields } = animal
  const created = await payload.create({ collection: 'animals', data: { ...fields, status: 'available', _status: 'published', estimatedBirthDate: date, ageEstimateReferenceDate: '2026-11-07', compatibility: { dogs, cats, children }, compatibilityNotes: 'Fictional assessment for demonstration; confirm all compatibility with the rescue before adoption.', photos: [{ photo: media[photo] }], internalNotes: 'Fictional demonstration record. Never use this fixture as an actual adoption listing.' } })
  animals[animal.slug] = created.id
}
const homepage = await payload.findGlobal({ slug: 'homepage', draft: true }) as any
if (!homepage.intro) await payload.updateGlobal({ slug: 'homepage', data: { heading: 'The best part of their story is still ahead.', intro: richText('Each week, we highlight a few adoptable pets who are ready for their next chapter — and a home to call their own.'), featuredAnimals: ['luna', 'milo', 'olive'].map((slug) => ({ animal: animals[slug] })), _status: 'published' } })
const articles = [
  { slug: 'adoption', title: 'Find your new best friend', category: 'adoption', text: 'This is a fictional local demonstration, not an operating rescue. In a real adoption process, the rescue will discuss your household, help you meet an animal and explain its approved adoption policies. Contact the rescue directly for current fees, application requirements and availability.' },
  { slug: 'volunteering', title: 'A little of your time. A lot of love.', category: 'volunteering', text: 'This fictional demonstration illustrates where approved volunteering information will appear. A real rescue may need help with animal care, transport, events and foster support. Ask the organization about its current opportunities, training and age requirements.' },
  { slug: 'care', title: 'Helping a new animal feel at home', category: 'care', text: 'Prepare a quiet space, fresh water and a predictable routine. Let your new companion settle at their own pace. Ask the rescue for its approved transition guidance and consult a veterinarian for individual health concerns. This is fictional demonstration content rather than a rescue policy.' },
] as const
for (const { text, ...article } of articles) {
  const existing = await payload.find({ collection: 'knowledge', where: { slug: { equals: article.slug } }, limit: 1, draft: true })
  if (!existing.docs.length) await payload.create({ collection: 'knowledge', data: { ...article, body: richText(text), source: 'Fictional demonstration fixture', reviewer: 'Demo content', reviewedAt: '2026-11-07', _status: 'published' } })
}
await seedMissingPages(payload)
console.log('Fictional demo content is ready. Existing records were preserved. Create your own administrator at /admin; the seed creates no staff accounts.')
await payload.destroy()
