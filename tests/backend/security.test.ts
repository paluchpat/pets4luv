import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPayload, type Payload } from 'payload'
import { animalDTO, buildAnimalWhere } from '../../src/lib/public-content'
import { seedAdoption } from '../../scripts/adoption-seed'
import { seedMissingPages } from '../../scripts/page-seeds'
import { seedVolunteering } from '../../scripts/volunteering-seed'
import { validatePageSlug } from '../../src/collections/Pages'

let payload: Payload
let directory: string
let admin: any
let editor: any
let draftID: number
let publishedID: number
let privateFileID: number
let publicPhotoID: number
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'pets4luv-security-'))
  process.env.DATABASE_URL = `file:${path.join(directory, 'test.db')}`
  process.env.LOCAL_UPLOAD_DIR = path.join(directory, 'uploads')
  const { default: config } = await import('../../src/payload.config')
  payload = await getPayload({ config })
  admin = await payload.create({ collection: 'users', data: { email: 'admin@example.invalid', password: 'Temporary-test-only-88327', name: 'Test Admin', role: 'admin' } })
  editor = await payload.create({ collection: 'users', overrideAccess: false, user: admin, data: { email: 'editor@example.invalid', password: 'Temporary-test-only-99236', name: 'Test Editor', role: 'editor' } })
  publicPhotoID = (await payload.create({ collection: 'media', data: { alt: 'Approved test fixture' }, filePath: path.resolve('public/images/luna.png') })).id
  const basic = { name: 'Fixture', slug: 'published-fixture', species: 'cat' as const, sex: 'female' as const, ageGroup: 'adult' as const, size: 'small' as const, summary: 'Fictional fixture', description: 'Fictional fixture', status: 'available' as const, internalNotes: 'PRIVATE SENTINEL', rescueIntakeID: 'PRIVATE-1', photos: [{ photo: publicPhotoID }], compatibility: { dogs: 'unknown' as const, cats: 'yes' as const, children: 'conditional' as const } }
  publishedID = (await payload.create({ collection: 'animals', data: { ...basic, colors: ['black', 'white'], _status: 'published' } })).id
  draftID = (await payload.create({ collection: 'animals', draft: true, data: { ...basic, colors: ['gray'], slug: 'secret-draft', rescueIntakeID: 'PRIVATE-2', _status: 'draft' } })).id
  privateFileID = (await payload.create({ collection: 'intake-files', data: { label: 'Private test card' }, file: { data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'), mimetype: 'image/png', name: `private-${Date.now()}.png`, size: 68 } })).id
})
after(async () => {
  if (payload) {
    await payload.destroy()
  }
  if (directory) await rm(directory, { recursive: true, force: true })
})

test('public collection reads exclude drafts and private animal fields', async () => {
  const result = await payload.find({ collection: 'animals', overrideAccess: false, draft: true, depth: 0 })
  assert.deepEqual(result.docs.map((doc) => doc.id), [publishedID])
  assert.equal(result.docs[0].internalNotes, undefined)
  assert.equal(result.docs[0].rescueIntakeID, undefined)
  await assert.rejects(() => payload.findByID({ collection: 'animals', id: draftID, overrideAccess: false, draft: true }))
  await assert.rejects(() => payload.findVersions({ collection: 'animals', overrideAccess: false }))
})

test('unknown and conditional compatibility never match a positive filter', async () => {
  const unknown = await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ goodWithDogs: true }) })
  const conditional = await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ goodWithChildren: true }) })
  const yes = await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ goodWithCats: true }) })
  assert.equal(unknown.totalDocs, 0)
  assert.equal(conditional.totalDocs, 0)
  assert.equal(yes.totalDocs, 1)
})

test('animal color matches any selected color on an available, published animal', async () => {
  for (const color of ['black', 'white']) {
    const result = await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ species: 'cat', color }) })
    assert.deepEqual(result.docs.map((doc) => doc.id), [publishedID])
  }
  for (const filters of [{ color: 'gray' }, { color: 'red' }, { color: 'white', species: 'dog' }]) {
    const result = await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere(filters) })
    assert.equal(result.totalDocs, 0)
  }
  assert.deepEqual(buildAnimalWhere({ color: 'not-a-color' }), buildAnimalWhere())
})

test('private files, intakes and write operations require staff', async () => {
  await assert.rejects(() => payload.find({ collection: 'intake-files', overrideAccess: false }))
  await assert.rejects(() => payload.findByID({ collection: 'intake-files', id: privateFileID, overrideAccess: false }))
  await assert.rejects(() => payload.find({ collection: 'intakes', overrideAccess: false }))
  await assert.rejects(() => payload.update({ collection: 'animals', id: publishedID, data: { name: 'Anonymous edit' }, overrideAccess: false }))
})

test('editor cannot create users or escalate their own role', async () => {
  await assert.rejects(() => payload.create({ collection: 'users', user: editor, overrideAccess: false, data: { email: 'intruder@example.invalid', password: 'Temporary-test-only-81336', name: 'Intruder', role: 'admin' } }))
  await payload.update({ collection: 'users', id: editor.id, user: editor, overrideAccess: false, data: { role: 'admin', name: 'Still an editor' } })
  const persisted = await payload.findByID({ collection: 'users', id: editor.id })
  assert.equal(persisted.role, 'editor')
})

test('homepage draft and draft relationships stay private', async () => {
  await payload.updateGlobal({ slug: 'homepage', data: { heading: 'Published heading', intro: { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'text', version: 1, text: 'Published introduction', detail: 0, format: 0, mode: 'normal', style: '' }] }] } }, featuredAnimals: [{ animal: publishedID }], _status: 'published' } })
  await payload.updateGlobal({ slug: 'homepage', draft: true, data: { heading: 'SECRET DRAFT HEADING', featuredAnimals: [{ animal: draftID }], _status: 'draft' } })
  const published = await payload.findGlobal({ slug: 'homepage', overrideAccess: false, draft: false })
  const requestedDraft = await payload.findGlobal({ slug: 'homepage', overrideAccess: false, draft: true })
  assert.equal(published.heading, 'Published heading')
  assert.equal(requestedDraft.heading, 'Published heading')
  assert.ok(!JSON.stringify(requestedDraft).includes('secret-draft'))
})

test('public DTO explicitly omits all internal fields and identifiers', () => {
  const dto = animalDTO({ id: 1, name: 'Safe', slug: 'safe', species: 'cat', sex: 'unknown', ageGroup: 'adult', size: 'small', status: 'available', internalNotes: 'PRIVATE', rescueIntakeID: 'SECRET', password: 'SECRET', photos: [{ photo: { url: '/api/media/file/public.webp', alt: 'Approved', private: 'SECRET' } }] })
  assert.deepEqual(Object.keys(dto).sort(), ['ageGroup', 'ageLabel', 'breed', 'careNeeds', 'compatibility', 'compatibilityNotes', 'description', 'id', 'name', 'photo', 'sex', 'size', 'slug', 'species', 'status', 'summary'].sort())
  assert.ok(!JSON.stringify(dto).includes('SECRET'))
})

test('staff can complete manual photo-pair intake, draft, publication and adoption without AI', async () => {
  const intake = await payload.create({ collection: 'intakes', overrideAccess: false, user: editor, data: { intakeID: 'MANUAL-TEST-1', animalPhoto: privateFileID, informationCard: privateFileID, submittedFacts: 'Test facts entered by a human. Two source slots remain separate.', state: 'manual-review' } })
  await assert.rejects(() => payload.create({ collection: 'intakes', overrideAccess: false, user: editor, data: { intakeID: 'MANUAL-TEST-1', animalPhoto: privateFileID, informationCard: privateFileID, submittedFacts: 'Retry', state: 'received' } }))
  const draft = await payload.create({ collection: 'animals', user: editor, overrideAccess: false, draft: true, data: { name: 'Manual fixture', slug: 'manual-fixture', rescueIntakeID: 'MANUAL-TEST-1', species: 'dog', sex: 'unknown', ageGroup: 'adult', size: 'medium', summary: 'Human supplied', description: 'Human reviewed description.', photos: [{ photo: publicPhotoID }], status: 'available', _status: 'draft' } })
  await payload.update({ collection: 'intakes', id: intake.id, user: editor, overrideAccess: false, data: { animal: draft.id, state: 'reviewed' } })
  await assert.rejects(() => payload.findByID({ collection: 'animals', id: draft.id, overrideAccess: false }))
  await payload.update({ collection: 'animals', id: draft.id, user: editor, overrideAccess: false, data: { _status: 'published' } })
  assert.equal((await payload.findByID({ collection: 'animals', id: draft.id, overrideAccess: false })).name, 'Manual fixture')
  await payload.update({ collection: 'animals', id: draft.id, user: editor, overrideAccess: false, data: { status: 'adopted' } })
  const available = await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ q: 'Manual fixture' }) })
  assert.equal(available.totalDocs, 0)
  assert.equal((await payload.findByID({ collection: 'animals', id: draft.id, overrideAccess: false })).status, 'adopted')
  await payload.update({ collection: 'intakes', id: intake.id, user: editor, overrideAccess: false, data: { state: 'complete' } })
})

function pageBody(text: string) {
  return { root: { type: 'root', format: '' as const, indent: 0, version: 1, direction: null, children: [{ type: 'paragraph', format: '' as const, indent: 0, version: 1, direction: null, children: [{ type: 'text', version: 1, text, detail: 0, format: 0, mode: 'normal', style: '' }] }] } }
}

test('Pages public reads exclude drafts and versions while staff can edit and publish', async () => {
  const page = await payload.create({ collection: 'pages', overrideAccess: false, user: editor, draft: true, data: { title: 'Private draft', slug: 'staff-page', body: pageBody('PRIVATE PAGE SENTINEL'), _status: 'draft' } })
  assert.equal((await payload.find({ collection: 'pages', overrideAccess: false, draft: true })).totalDocs, 0)
  await assert.rejects(() => payload.findByID({ collection: 'pages', id: page.id, overrideAccess: false, draft: true }))
  await assert.rejects(() => payload.findVersions({ collection: 'pages', overrideAccess: false }))
  await assert.rejects(() => payload.create({ collection: 'pages', overrideAccess: false, data: { title: 'Anonymous', slug: 'anonymous', body: pageBody('Anonymous body'), _status: 'published' } }))
  await assert.rejects(() => payload.update({ collection: 'pages', id: page.id, overrideAccess: false, data: { title: 'Anonymous edit' } }))
  await assert.rejects(() => payload.delete({ collection: 'pages', id: page.id, overrideAccess: false }))

  await payload.update({ collection: 'pages', id: page.id, overrideAccess: false, user: editor, data: { title: 'Published page', body: pageBody('Published page body'), _status: 'published' } })
  assert.equal((await payload.findByID({ collection: 'pages', id: page.id, overrideAccess: false, draft: false })).title, 'Published page')
  await payload.update({ collection: 'pages', id: page.id, overrideAccess: false, user: editor, draft: true, data: { title: 'PRIVATE REVISION', body: pageBody('PRIVATE REVISION BODY'), _status: 'draft' } })
  const publicRead = await payload.find({ collection: 'pages', overrideAccess: false, draft: true })
  assert.equal(publicRead.totalDocs, 0)
  assert.ok(!JSON.stringify(publicRead).includes('PRIVATE'))
  assert.equal((await payload.findByID({ collection: 'pages', id: page.id, overrideAccess: false, draft: false })).title, 'Published page')
  assert.equal((await payload.findByID({ collection: 'pages', id: page.id, user: editor, overrideAccess: false, draft: true })).title, 'PRIVATE REVISION')
})

test('Pages slugs are unique, root-only and cannot collide with reserved routes', async () => {
  for (const slug of ['animals', 'admin', 'api', 'info', 'media', 'pages', 'homepage', 'nested/path', '/donate', 'UPPER', '', 'two--hyphens']) assert.notEqual(validatePageSlug(slug), true, slug)
  assert.equal(validatePageSlug('donate'), true)
  await assert.rejects(() => payload.create({ collection: 'pages', user: editor, overrideAccess: false, data: { title: 'Reserved', slug: 'animals', body: pageBody('Reserved'), _status: 'published' } }))
  await assert.rejects(() => payload.create({ collection: 'pages', user: editor, overrideAccess: false, data: { title: 'Duplicate', slug: 'staff-page', body: pageBody('Duplicate'), _status: 'published' } }))
})

test('page seed creates missing starter pages and preserves existing drafts', async () => {
  const donate = await payload.create({ collection: 'pages', user: editor, overrideAccess: false, draft: true, data: { title: 'Manager draft donation copy', slug: 'donate', body: pageBody('DO NOT OVERWRITE'), _status: 'draft' } })
  const beforeAnimals = await payload.count({ collection: 'animals' })
  const beforeUsers = await payload.count({ collection: 'users' })
  assert.deepEqual(await seedMissingPages(payload), ['contact', 'about'])
  assert.deepEqual(await seedMissingPages(payload), [])
  const preserved = await payload.findByID({ collection: 'pages', id: donate.id, draft: true })
  assert.equal(preserved.title, 'Manager draft donation copy')
  assert.equal(preserved._status, 'draft')
  assert.ok(JSON.stringify(preserved.body).includes('DO NOT OVERWRITE'))
  const contact = await payload.find({ collection: 'pages', overrideAccess: false, where: { slug: { equals: 'contact' } } })
  assert.equal(contact.docs[0]?.title, 'Contact Pets4Luv')
  assert.ok(!JSON.stringify(contact.docs).includes('pets4luv.org'))
  const { docs: [about] } = await payload.find({ collection: 'pages', overrideAccess: false, where: { slug: { equals: 'about' } } })
  assert.equal(about?.title, 'About Pets4Luv')
  assert.equal(about._status, 'published')
  const list = about.body.root.children.find(node => node.type === 'list')
  assert.equal(list?.tag, 'ul')
  assert.equal(Array.isArray(list?.children) && list.children.length, 6)
  const aboutBody = JSON.stringify(about.body)
  for (const href of ['tel:+15168607057', 'mailto:info@pets4luv.org', '/animals']) assert.ok(aboutBody.includes(href))
  assert.equal((await payload.count({ collection: 'animals' })).totalDocs, beforeAnimals.totalDocs)
  assert.equal((await payload.count({ collection: 'users' })).totalDocs, beforeUsers.totalDocs)
})

test('volunteering seed creates official copy and only upgrades the exact demo without a pending draft', async () => {
  assert.equal(await seedVolunteering(payload), 'created')
  const { docs: [article] } = await payload.find({ collection: 'knowledge', where: { slug: { equals: 'volunteering' } }, depth: 0 })
  assert.equal(article.title, 'Volunteer with Pets4Luv')
  assert.equal(await seedVolunteering(payload), 'preserved')

  const body = pageBody('This fictional demonstration illustrates where approved volunteering information will appear. A real rescue may need help with animal care, transport, events and foster support. Ask the organization about its current opportunities, training and age requirements.')
  Object.assign(body.root.children[0], { textFormat: 0, textStyle: '' })
  const demo = {
    title: 'A little of your time. A lot of love.',
    slug: 'volunteering',
    category: 'volunteering',
    body,
    source: 'Fictional demonstration fixture',
    reviewer: 'Demo content',
    reviewedAt: '2026-11-07',
    _status: 'published',
  } as const
  const record = { collection: 'knowledge', id: article.id, depth: 0 } as const

  const edited = await payload.update({ ...record, data: { ...demo, body: pageBody('Staff edited volunteering copy.') } })
  assert.equal(await seedVolunteering(payload), 'preserved')
  assert.deepEqual((await payload.findByID(record)).body, edited.body)

  await payload.update({ ...record, data: demo })
  const draft = await payload.update({ ...record, draft: true, data: { slug: 'volunteering-draft', title: 'Staff draft', _status: 'draft' } })
  assert.equal(await seedVolunteering(payload), 'preserved')
  const latest = await payload.findByID({ ...record, draft: true })
  assert.equal(latest._status, 'draft')
  assert.equal(latest.slug, draft.slug)
  assert.equal(latest.title, draft.title)
  assert.equal((await payload.findByID({ ...record, draft: false })).title, demo.title)

  await payload.update({ ...record, data: demo })
  assert.equal(await seedVolunteering(payload), 'updated')
  const updated = await payload.findByID({ ...record, overrideAccess: false })
  assert.equal(updated.title, 'Volunteer with Pets4Luv')
  assert.equal(updated.source, 'https://www.pets4luv.org/volunteering')
  assert.equal(updated.reviewer, null)
  assert.equal(updated.reviewedAt, null)
  assert.equal(updated.body.root.children.length, 3)
  const publishedBody = JSON.stringify(updated.body)
  assert.ok(publishedBody.includes('mailto:info@pets4luv.org'))
  assert.ok(publishedBody.includes('tel:+15168607057'))
  assert.equal(await seedVolunteering(payload), 'preserved')
})

test('adoption seed replaces the untouched shared demo and preserves independently edited species articles', async () => {
  const body = pageBody('This is a fictional local demonstration, not an operating rescue. In a real adoption process, the rescue will discuss your household, help you meet an animal and explain its approved adoption policies. Contact the rescue directly for current fees, application requirements and availability.')
  Object.assign(body.root.children[0], { textFormat: 0, textStyle: '' })
  const legacy = await payload.create({ collection: 'knowledge', data: { title: 'Find your new best friend', slug: 'adoption', category: 'adoption', body, source: 'Fictional demonstration fixture', reviewer: 'Demo content', reviewedAt: '2026-11-07', _status: 'published' } })
  const cat = await payload.create({ collection: 'knowledge', draft: true, data: { title: 'Staff cat draft', slug: 'cat-adoption', category: 'adoption', body: pageBody('Pending cat edits.'), _status: 'draft' } })

  assert.deepEqual(await seedAdoption(payload), { adoption: 'updated', 'cat-adoption': 'preserved', 'dog-adoption': 'created' })
  const shared = await payload.findByID({ collection: 'knowledge', id: legacy.id, overrideAccess: false })
  assert.equal(shared.title, 'How adoption works')
  assert.equal(shared.reviewer, null)
  assert.equal(shared.reviewedAt, null)
  assert.match(shared.source ?? '', /Cat-Adoption-Information.*Dog-Adoption-Information/)
  const steps = shared.body.root.children.find(node => node.type === 'list')
  assert.equal(steps?.tag, 'ol')
  assert.equal(Array.isArray(steps?.children) && steps.children.length, 3)
  for (const href of ['mailto:info@pets4luv.org', 'tel:+15168607057']) assert.ok(JSON.stringify(shared.body).includes(href))
  assert.equal((await payload.findByID({ collection: 'knowledge', id: cat.id, draft: true })).title, 'Staff cat draft')
  await assert.rejects(() => payload.findByID({ collection: 'knowledge', id: cat.id, draft: false, overrideAccess: false }))

  const { docs: [dog] } = await payload.find({ collection: 'knowledge', where: { slug: { equals: 'dog-adoption' } }, overrideAccess: false })
  assert.equal(dog.title, 'Dog adoption')
  await payload.update({ collection: 'knowledge', id: dog.id, data: { title: 'Staff dog copy' } })
  assert.deepEqual(await seedAdoption(payload), { adoption: 'preserved', 'cat-adoption': 'preserved', 'dog-adoption': 'preserved' })
  assert.equal((await payload.findByID({ collection: 'knowledge', id: dog.id, overrideAccess: false })).title, 'Staff dog copy')
})
