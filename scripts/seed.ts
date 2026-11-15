import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { seedAdoption } from './adoption-seed'
import { seedMissingPages } from './page-seeds'
import { seedVolunteering } from './volunteering-seed'

const payload = await getPayload({ config })
function richText(text: string) {
  return { root: { type: 'root', format: '' as const, indent: 0, version: 1, direction: null, children: [{ type: 'paragraph', format: '' as const, indent: 0, version: 1, direction: null, textFormat: 0, textStyle: '', children: [{ type: 'text', version: 1, text, detail: 0, format: 0, mode: 'normal', style: '' }] }] } }
}

const demoAnimalNote = 'Fictional demonstration record. Never use this fixture as an actual adoption listing.'

const demo = [
  { name: 'Luna', slug: 'luna', species: 'cat', sex: 'female', ageGroup: 'young', size: 'small', breed: 'Domestic shorthair', photo: 'luna', colors: ['brown', 'black', 'white'], summary: 'A little curious. A lot lovable.', description: 'Luna is a playful little explorer who loves a sunny windowsill and a gentle game. This fictional profile is here to demonstrate the adoption experience.', dogs: 'unknown', cats: 'yes', children: 'conditional', date: '2025-04-01' },
  { name: 'Milo', slug: 'milo', species: 'dog', sex: 'male', ageGroup: 'adult', size: 'medium', breed: 'Mixed breed', photo: 'milo', colors: ['black', 'white'], summary: 'Your next adventure buddy.', description: 'Milo is happiest on a walk with a kind companion. He would love room to explore and people to come home to. This is a fictional demonstration profile.', dogs: 'yes', cats: 'unknown', children: 'yes', date: '2022-05-01' },
  { name: 'Olive', slug: 'olive', species: 'cat', sex: 'female', ageGroup: 'adult', size: 'small', breed: 'Domestic shorthair', photo: 'olive', colors: ['brown', 'orange', 'black', 'cream'], summary: 'A soft spot for the quiet life.', description: 'Olive enjoys slow mornings and a cozy spot beside someone she trusts. This fictional profile is for the local demonstration only.', dogs: 'no', cats: 'conditional', children: 'unknown', date: '2021-03-01' },
  { name: 'Jasper', slug: 'jasper', species: 'dog', sex: 'male', ageGroup: 'senior', size: 'large', breed: 'Mixed breed', photo: 'jasper', colors: ['gold', 'tan', 'gray'], summary: 'An old soul with plenty of love to give.', description: 'Jasper is a fictional senior dog fixture for trying gallery filters.', dogs: 'conditional', cats: 'unknown', children: 'yes', date: '2015-02-01' },
  { name: 'Poppy', slug: 'poppy', species: 'cat', sex: 'female', ageGroup: 'baby', size: 'small', breed: 'Domestic shorthair', photo: 'poppy', colors: ['gray', 'white'], summary: 'Tiny paws, big plans.', description: 'Poppy is a fictional kitten fixture for trying gallery filters.', dogs: 'unknown', cats: 'yes', children: 'unknown', date: '2026-07-01' },
  { name: 'Scout', slug: 'scout', species: 'dog', sex: 'female', ageGroup: 'young', size: 'small', breed: 'Mixed breed', photo: 'scout', colors: ['tan', 'gold'], summary: 'Ready to learn and ready to love.', description: 'Scout is a fictional young dog fixture for trying gallery filters.', dogs: 'yes', cats: 'no', children: 'conditional', date: '2025-08-01' },
  { name: 'Fern', slug: 'fern', species: 'cat', sex: 'female', ageGroup: 'senior', size: 'small', breed: 'Domestic shorthair', photo: 'fern', colors: ['black'], summary: 'A quiet companion for slow afternoons.', description: 'Fern is a black cat who likes warm blankets and a familiar lap. This is a fictional demonstration profile.', dogs: 'no', cats: 'conditional', children: 'conditional', date: '2013-03-01' },
  { name: 'Atlas', slug: 'atlas', species: 'dog', sex: 'male', ageGroup: 'senior', size: 'large', breed: 'German shepherd mix', photo: 'atlas', colors: ['black', 'tan', 'gray'], summary: 'Happiest on a stroll with time to sniff.', description: 'Atlas is a senior shepherd mix who enjoys a gentle walk and a soft bed near his people. His estimated birth date is unknown. This is a fictional demonstration profile.', dogs: 'conditional', cats: 'no', children: 'yes', date: null },
  { name: 'Wren', slug: 'wren', species: 'dog', sex: 'female', ageGroup: 'baby', size: 'small', breed: 'Mixed breed', photo: 'wren', colors: ['tan', 'white'], summary: 'One more game before nap time.', description: 'Wren is a tan and white puppy who likes soft toys and short play sessions. This is a fictional demonstration profile.', dogs: 'yes', cats: 'unknown', children: 'conditional', date: '2026-10-01' },
  { name: 'Maple', slug: 'maple', species: 'cat', sex: 'female', ageGroup: 'adult', size: 'small', breed: 'Domestic shorthair', photo: 'maple', colors: ['black', 'orange'], summary: 'A window seat is her favorite spot.', description: 'Maple is a tortoiseshell cat who likes birdwatching and will come over for attention when she feels settled. This is a fictional demonstration profile.', dogs: 'conditional', cats: 'yes', children: 'unknown', date: '2021-03-01' },
  { name: 'Otis', slug: 'otis', species: 'dog', sex: 'male', ageGroup: 'adult', size: 'medium', breed: 'Mixed breed', photo: 'otis', colors: ['brown', 'black', 'white'], summary: 'Bring a tennis ball and stay awhile.', description: 'Otis is a brindle dog who enjoys fetch and settles down beside his people after a walk. This is a fictional demonstration profile.', dogs: 'yes', cats: 'no', children: 'yes', date: '2023-11-10' },
  { name: 'Bee', slug: 'bee', species: 'cat', sex: 'male', ageGroup: 'baby', size: 'small', breed: 'Domestic shorthair', photo: 'bee', colors: ['orange', 'cream'], summary: 'An orange kitten with a soft spot for toys.', description: 'Bee likes chasing a wand toy, then finding the nearest sunny patch for a nap. This is a fictional demonstration profile.', dogs: 'unknown', cats: 'yes', children: 'yes', date: '2026-05-01' },
  { name: 'Cleo', slug: 'cleo', species: 'cat', sex: 'female', ageGroup: 'adult', size: 'small', breed: 'Domestic shorthair', photo: 'cleo', colors: ['gray', 'white'], summary: 'She will greet you when the house gets quiet.', description: 'Cleo is a white and gray cat who likes steady routines and gentle company. Her estimated birth date is unknown. This is a fictional demonstration profile.', dogs: 'no', cats: 'unknown', children: 'conditional', date: null },
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
  const existing = found.docs[0]
  const { photo, colors, dogs, cats, children, date, ...fields } = animal
  if (existing) {
    // Payload updates start from the latest version, so skip fixtures with pending drafts.
    if (existing._status === 'published' && existing.internalNotes === demoAnimalNote && !existing.colors?.length) {
      await payload.update({ collection: 'animals', id: existing.id, data: { colors: [...colors], _status: 'published' } })
    }
    animals[animal.slug] = existing.id
    continue
  }
  const created = await payload.create({ collection: 'animals', data: { ...fields, colors: [...colors], status: 'available', _status: 'published', estimatedBirthDate: date, ageEstimateReferenceDate: '2026-11-07', compatibility: { dogs, cats, children }, compatibilityNotes: 'Fictional assessment for demonstration; confirm all compatibility with the rescue before adoption.', photos: [{ photo: media[photo] }], internalNotes: demoAnimalNote } })
  animals[animal.slug] = created.id
}
const homepage = await payload.findGlobal({ slug: 'homepage', draft: true }) as any
if (!homepage.intro) await payload.updateGlobal({ slug: 'homepage', data: { heading: 'The best part of their story is still ahead.', intro: richText('Each week, we highlight a few adoptable pets who are ready for their next chapter — and a home to call their own.'), featuredAnimals: ['luna', 'milo', 'olive'].map((slug) => ({ animal: animals[slug] })), _status: 'published' } })
const articles = [
  { slug: 'care', title: 'Helping a new animal feel at home', category: 'care', text: 'Prepare a quiet space, fresh water and a predictable routine. Let your new companion settle at their own pace. Ask the rescue for its approved transition guidance and consult a veterinarian for individual health concerns. This is fictional demonstration content rather than a rescue policy.' },
] as const
for (const { text, ...article } of articles) {
  const existing = await payload.find({ collection: 'knowledge', where: { slug: { equals: article.slug } }, limit: 1, draft: true })
  if (!existing.docs.length) await payload.create({ collection: 'knowledge', data: { ...article, body: richText(text), source: 'Fictional demonstration fixture', reviewer: 'Demo content', reviewedAt: '2026-11-07', _status: 'published' } })
}
await seedAdoption(payload)
await seedVolunteering(payload)
await seedMissingPages(payload)
console.log('Starter content is ready. Existing edits were preserved. Create your own administrator at /admin. The seed creates no staff accounts.')
await payload.destroy()
