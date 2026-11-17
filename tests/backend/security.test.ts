import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPayload, type Payload } from 'payload'
import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { createClient } from '@libsql/client'
import { animalDTO, buildAnimalWhere, homepageIntroDTO, richTextToText } from '../../src/lib/public-content'
import { consolidateAdoption, seedAdoption } from '../../scripts/adoption-seed'
import { seedPages } from '../../scripts/page-seeds'
import { seedVolunteering } from '../../scripts/volunteering-seed'
import { prepareHomepageIntro } from '../../scripts/homepage-intro-schema'
import { prepareInformationPages } from '../../scripts/information-pages-schema'
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

test('homepage intro fallback retains the approved foundation copy and donation link', () => {
  const expectedText = 'We are a volunteer-run, no-kill cat and dog rescue in Freeport, New York. We rescue, rehabilitate, and rehome animals, with a focus on seniors and animals who are injured, ill, disabled, or have other special needs. We give them a safe place to rest and recover at their own pace.\n\nWe rely on your donations to give animals the care they need and the chance to find a loving home.'
  for (const source of [undefined, { heading: 'PRIVATE INTRO', body: pageBody('PRIVATE BODY'), _status: 'draft' }]) {
    const intro = homepageIntroDTO(source)
    assert.equal(intro.heading, 'Pets4Luv Foundation')
    assert.equal(intro.bodyText, expectedText)
    assert.equal(intro.body.root.children.length, 2)
    const donationLink = (intro.body.root.children[1] as any).children.find((node: any) => node.type === 'link')
    assert.equal(donationLink.fields.url, '/donate')
    assert.equal(richTextToText(donationLink), 'your donations')
  }
})

test('homepage intro supports staff drafts and publication without leaking drafts or changing highlights', async () => {
  const highlights = await payload.findGlobal({ slug: 'homepage', draft: true, depth: 0 })
  await assert.rejects(() => payload.updateGlobal({ slug: 'homepage-intro', overrideAccess: false, data: { heading: 'Anonymous edit', body: pageBody('Anonymous body'), _status: 'published' } }))
  await assert.rejects(() => payload.findGlobalVersions({ slug: 'homepage-intro', overrideAccess: false }))

  const defaults = await payload.updateGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, draft: true, data: { _status: 'draft' } })
  assert.equal(defaults.heading, 'Pets4Luv Foundation')
  assert.equal(richTextToText(defaults.body), homepageIntroDTO(undefined).bodyText)
  assert.ok(JSON.stringify(defaults.body).includes('/donate'))
  const firstDraft = await payload.updateGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, draft: true, data: { heading: 'PRIVATE FIRST INTRO', body: pageBody('PRIVATE FIRST BODY'), _status: 'draft' } })
  assert.equal(firstDraft._status, 'draft')
  const publicDraft = await payload.findGlobal({ slug: 'homepage-intro', overrideAccess: false, draft: true })
  assert.ok(!JSON.stringify(publicDraft).includes('PRIVATE'))
  const preview = await payload.findGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, draft: true })
  assert.equal(homepageIntroDTO(preview, true).heading, 'PRIVATE FIRST INTRO')
  assert.equal(homepageIntroDTO(preview).heading, 'Pets4Luv Foundation')

  await payload.updateGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, data: { heading: 'Published foundation heading', body: pageBody('Published foundation body'), _status: 'published' } })
  await payload.updateGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, draft: true, data: { heading: 'PRIVATE REVISION', body: pageBody('PRIVATE REVISION BODY'), _status: 'draft' } })
  for (const draft of [false, true]) {
    const published = await payload.findGlobal({ slug: 'homepage-intro', overrideAccess: false, draft })
    assert.equal(published.heading, 'Published foundation heading')
    assert.equal(homepageIntroDTO(published).bodyText, 'Published foundation body')
    assert.ok(!JSON.stringify(published).includes('PRIVATE'))
  }
  const latest = await payload.findGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, draft: true })
  assert.equal(homepageIntroDTO(latest, true).bodyText, 'PRIVATE REVISION BODY')
  const versions = await payload.findGlobalVersions({ slug: 'homepage-intro', user: editor, overrideAccess: false })
  assert.ok(versions.totalDocs >= 3)
  await assert.rejects(() => payload.findGlobalVersions({ slug: 'homepage-intro', overrideAccess: false }))
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage', draft: true, depth: 0 }), highlights)
})

test('homepage intro bootstrap upgrades the old schema and preserves staff content on retries', async () => {
  const client = (payload.db as unknown as SQLiteAdapter).client
  const highlights = await payload.findGlobal({ slug: 'homepage', draft: true, depth: 0 })
  const highlightVersions = await payload.findGlobalVersions({ slug: 'homepage', user: editor, overrideAccess: false })
  // This client belongs only to the mkdtemp test.db created by the suite's before hook.
  await client.batch(['DROP TABLE _homepage_intro_v', 'DROP TABLE homepage_intro'], 'write')
  const tableNames = async () => (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).rows.map(row => row.name)
  const oldTables = await tableNames()

  await prepareHomepageIntro(client)
  assert.deepEqual(await tableNames(), [...oldTables, 'homepage_intro', '_homepage_intro_v'].sort())
  const initial = await payload.findGlobal({ slug: 'homepage-intro', overrideAccess: false, draft: false })
  assert.equal(initial._status, 'published')
  assert.equal(initial.heading, 'Pets4Luv Foundation')
  assert.equal(richTextToText(initial.body), homepageIntroDTO(undefined).bodyText)
  const versions = await payload.findGlobalVersions({ slug: 'homepage-intro', user: editor, overrideAccess: false })
  assert.equal(versions.totalDocs, 1)
  assert.equal(versions.docs[0].version._status, 'published')
  assert.equal(versions.docs[0].version.heading, initial.heading)
  assert.deepEqual(versions.docs[0].version.body, initial.body)

  const introRows = async () => ({
    intro: (await client.execute('SELECT * FROM homepage_intro ORDER BY id')).rows,
    versions: (await client.execute('SELECT * FROM _homepage_intro_v ORDER BY id')).rows,
  })
  const seededRows = await introRows()
  await prepareHomepageIntro(client)
  assert.deepEqual(await introRows(), seededRows)

  await payload.updateGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, data: { heading: 'Staff published introduction', body: pageBody('Staff published body'), _status: 'published' } })
  await payload.updateGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, draft: true, data: { heading: 'Staff pending introduction', body: pageBody('Staff pending body'), _status: 'draft' } })
  const staffRows = await introRows()
  const published = await payload.findGlobal({ slug: 'homepage-intro', overrideAccess: false, draft: false })
  const draft = await payload.findGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, draft: true })
  assert.equal(published.heading, 'Staff published introduction')
  assert.equal(richTextToText(published.body), 'Staff published body')
  assert.equal(draft.heading, 'Staff pending introduction')
  assert.equal(richTextToText(draft.body), 'Staff pending body')
  await prepareHomepageIntro(client)
  assert.deepEqual(await introRows(), staffRows)
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage-intro', overrideAccess: false, draft: false }), published)
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage-intro', user: editor, overrideAccess: false, draft: true }), draft)
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage', draft: true, depth: 0 }), highlights)
  assert.deepEqual(await payload.findGlobalVersions({ slug: 'homepage', user: editor, overrideAccess: false }), highlightVersions)
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
  for (const slug of ['animals', 'applications', 'admin', 'api', 'info', 'media', 'pages', 'homepage', 'nested/path', '/donate', 'UPPER', '', 'two--hyphens']) assert.notEqual(validatePageSlug(slug), true, slug)
  assert.equal(validatePageSlug('donate'), true)
  await assert.rejects(() => payload.create({ collection: 'pages', user: editor, overrideAccess: false, data: { title: 'Reserved', slug: 'animals', body: pageBody('Reserved'), _status: 'published' } }))
  await assert.rejects(() => payload.create({ collection: 'pages', user: editor, overrideAccess: false, data: { title: 'Duplicate', slug: 'staff-page', body: pageBody('Duplicate'), _status: 'published' } }))
})

test('page seed creates missing starter pages and preserves existing drafts', async () => {
  const donate = await payload.create({ collection: 'pages', user: editor, overrideAccess: false, draft: true, data: { title: 'Manager draft donation copy', slug: 'donate', body: pageBody('DO NOT OVERWRITE'), _status: 'draft' } })
  const beforeAnimals = await payload.count({ collection: 'animals' })
  const beforeUsers = await payload.count({ collection: 'users' })
  assert.deepEqual(await seedPages(payload), { created: ['contact', 'about', 'tnr', 'medical', 'injured-feral-cats'], refreshedContact: false })
  assert.deepEqual(await seedPages(payload), { created: [], refreshedContact: false })
  const preserved = await payload.findByID({ collection: 'pages', id: donate.id, draft: true })
  assert.equal(preserved.title, 'Manager draft donation copy')
  assert.equal(preserved._status, 'draft')
  assert.ok(JSON.stringify(preserved.body).includes('DO NOT OVERWRITE'))
  const contact = await payload.find({ collection: 'pages', overrideAccess: false, where: { slug: { equals: 'contact' } } })
  assert.equal(contact.docs[0]?.title, 'Contact Pets4Luv')
  assert.ok(!JSON.stringify(contact.docs).includes('Approved contact details'))
  const { docs: [about] } = await payload.find({ collection: 'pages', overrideAccess: false, where: { slug: { equals: 'about' } } })
  assert.equal(about?.title, 'About Pets4Luv')
  assert.equal(about._status, 'published')
  const list = about.body.root.children.find(node => node.type === 'list')
  assert.equal(list?.tag, 'ul')
  assert.equal(Array.isArray(list?.children) && list.children.length, 6)
  const aboutBody = JSON.stringify(about.body)
  for (const href of ['tel:+15168607057', 'mailto:info@pets4luv.org', '/animals']) assert.ok(aboutBody.includes(href))
  for (const [slug, title] of Object.entries({ tnr: 'Trap-Neuter-Return (TNR)', medical: 'Medical Assistance', 'injured-feral-cats': 'Injured Feral Cats' })) {
    const { docs: [page] } = await payload.find({ collection: 'pages', overrideAccess: false, where: { slug: { equals: slug } } })
    assert.equal(page?.title, title)
    assert.equal(page._status, 'published')
    const content = JSON.stringify(page.body)
    assert.ok(content.includes('tel:+15168607057'))
    assert.ok(content.includes('mailto:info@pets4luv.org'))
  }
  assert.equal((await payload.count({ collection: 'animals' })).totalDocs, beforeAnimals.totalDocs)
  assert.equal((await payload.count({ collection: 'users' })).totalDocs, beforeUsers.totalDocs)
})

test('the Contact starter refresh preserves a pending draft and published staff edits', async () => {
  const { docs: [contact] } = await payload.find({ collection: 'pages', where: { slug: { equals: 'contact' } } })
  const previousBody = structuredClone(contact.body)
  const placeholder = pageBody('Approved contact details will be added here when they are ready. Please check back for ways to get in touch.').root.children[0]
  Object.assign(placeholder, { textFormat: 0, textStyle: '' })
  previousBody.root.children.push(placeholder)
  await payload.update({ collection: 'pages', id: contact.id, data: { body: previousBody, _status: 'published' } })

  await payload.update({ collection: 'pages', id: contact.id, draft: true, data: { title: 'Pending staff contact edit', slug: 'contact-draft', _status: 'draft' } })
  assert.deepEqual(await seedPages(payload), { created: [], refreshedContact: false })
  assert.equal((await payload.findByID({ collection: 'pages', id: contact.id, draft: true })).slug, 'contact-draft')
  assert.deepEqual((await payload.findByID({ collection: 'pages', id: contact.id, draft: false })).body, previousBody)

  await payload.update({ collection: 'pages', id: contact.id, data: { title: 'Staff contact information', slug: contact.slug, body: previousBody, _status: 'published' } })
  assert.deepEqual(await seedPages(payload), { created: [], refreshedContact: false })
  await payload.update({ collection: 'pages', id: contact.id, data: { title: contact.title, _status: 'published' } })

  assert.deepEqual(await seedPages(payload), { created: [], refreshedContact: true })
  assert.deepEqual((await payload.findByID({ collection: 'pages', id: contact.id, draft: false })).body, contact.body)
  assert.deepEqual(await seedPages(payload), { created: [], refreshedContact: false })
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

test('adoption seed writes a single article and preserves staff drafts', async () => {
  assert.deepEqual(await seedAdoption(payload), { adoption: 'created' })
  const { docs: [shared], totalDocs } = await payload.find({ collection: 'knowledge', where: { category: { equals: 'adoption' } }, overrideAccess: false })
  assert.equal(totalDocs, 1)
  assert.equal(shared.slug, 'adoption')
  assert.equal(shared.title, 'How adoption works')
  assert.equal(shared.reviewer, null)
  assert.equal(shared.reviewedAt, null)
  assert.match(shared.source ?? '', /Cat-Adoption-Information.*Dog-Adoption-Information/)
  const steps = shared.body.root.children.find(node => node.type === 'list')
  assert.equal(steps?.tag, 'ol')
  assert.equal(Array.isArray(steps?.children) && steps.children.length, 3)
  for (const href of ['mailto:info@pets4luv.org', 'tel:+15168607057']) assert.ok(JSON.stringify(shared.body).includes(href))
  assert.deepEqual(shared.body.root.children.filter(node => node.type === 'heading').map(node => [node.tag, richTextToText(node)]), [
    ['h2', 'Cat adoption'],
    ['h2', 'Dog adoption'],
  ])

  const body = pageBody('This is a fictional local demonstration, not an operating rescue. In a real adoption process, the rescue will discuss your household, help you meet an animal and explain its approved adoption policies. Contact the rescue directly for current fees, application requirements and availability.')
  Object.assign(body.root.children[0], { textFormat: 0, textStyle: '' })
  const demo = { title: 'Find your new best friend', slug: 'adoption', body, source: 'Fictional demonstration fixture', reviewer: 'Demo content', reviewedAt: '2026-11-07', _status: 'published' } as const
  const record = { collection: 'knowledge', id: shared.id } as const
  await payload.update({ ...record, data: demo })
  await payload.update({ ...record, draft: true, data: { slug: 'adoption-draft', title: 'Staff adoption draft', _status: 'draft' } })
  assert.deepEqual(await seedAdoption(payload), { adoption: 'preserved' })
  assert.equal((await payload.findByID({ ...record, draft: true })).title, 'Staff adoption draft')
  assert.deepEqual((await payload.findByID({ ...record, draft: false })).body, demo.body)

  await payload.update({ ...record, data: demo })
  const cat = await payload.create({ collection: 'knowledge', draft: true, data: { title: 'Staff cat draft', slug: 'cat-adoption', category: 'adoption', body: pageBody('Pending cat edits.'), _status: 'draft' } })
  assert.deepEqual(await seedAdoption(payload), { adoption: 'updated' })
  assert.deepEqual((await payload.findByID({ ...record, overrideAccess: false })).body, shared.body)
  assert.equal((await payload.findByID({ collection: 'knowledge', id: cat.id, draft: true })).title, 'Staff cat draft')
  assert.deepEqual(await seedAdoption(payload), { adoption: 'preserved' })

  await payload.delete({ collection: 'knowledge', id: cat.id })
  await payload.delete(record)
})

test('adoption consolidation copies published edits and resumes after a partial deletion', async t => {
  const collection = 'knowledge' as const
  const defaults = { category: 'adoption', _status: 'published' } as const
  const overview = await payload.create({ collection, data: { ...defaults, title: 'Staff adoption overview', slug: 'adoption', body: pageBody('Edited overview.'), source: 'Edited source.' } })
  const cat = await payload.create({ collection, data: { ...defaults, title: 'Cat adoption', slug: 'cat-adoption', body: pageBody('Edited cat policy.') } })
  const dog = await payload.create({ collection, data: { ...defaults, title: 'Dog adoption', slug: 'dog-adoption', body: pageBody('Edited dog policy.') } })
  const record = { collection, id: overview.id } as const
  const dogRecord = { collection, id: dog.id } as const
  await payload.update({ ...dogRecord, draft: true, data: { slug: 'dog-adoption-draft', body: pageBody('Pending staff edits.'), _status: 'draft' } })
  await assert.rejects(() => consolidateAdoption(payload), /draft for "dog-adoption"/)
  assert.deepEqual((await payload.findByID(record)).body, overview.body)
  assert.equal((await payload.findByID({ collection, id: cat.id })).slug, cat.slug)
  await payload.update({ ...dogRecord, data: { slug: dog.slug, body: dog.body, _status: 'published' } })

  const originalDelete = payload.delete
  const failSecondDelete = t.mock.method(payload, 'delete', async (options: { id?: number }) => {
    if (options.id === dog.id) throw new Error('Temporary deletion failure')
    return Reflect.apply(originalDelete, payload, [options])
  })
  await assert.rejects(() => consolidateAdoption(payload), /Temporary deletion failure/)
  failSecondDelete.mock.restore()

  const combined = await payload.findByID(record)
  assert.equal(combined.title, overview.title)
  assert.equal(combined.source, overview.source)
  const combinedChildren = combined.body.root.children
  assert.deepEqual(combinedChildren.map(richTextToText), [
    'Edited overview.',
    'Cat adoption',
    'Edited cat policy.',
    'Dog adoption',
    'Edited dog policy.',
  ])
  assert.deepEqual([combinedChildren[1].tag, combinedChildren[3].tag], ['h2', 'h2'])
  assert.deepEqual(combinedChildren[0], overview.body.root.children[0])
  assert.deepEqual(combinedChildren[2], cat.body.root.children[0])
  assert.deepEqual(combinedChildren[4], dog.body.root.children[0])
  assert.equal(await payload.findByID({ collection, id: cat.id, disableErrors: true }), null)

  await payload.update({ ...dogRecord, data: { body: pageBody('New dog policy.') } })
  await assert.rejects(() => consolidateAdoption(payload), /different copy for "dog-adoption"/)
  assert.equal(richTextToText((await payload.findByID(dogRecord)).body), 'New dog policy.')
  assert.deepEqual((await payload.findByID(record)).body, combined.body)

  await payload.update({ ...dogRecord, data: { body: dog.body } })
  assert.deepEqual(await consolidateAdoption(payload), { updated: false, deleted: ['dog-adoption'] })
  assert.deepEqual(await consolidateAdoption(payload), { updated: false, deleted: [] })
  assert.equal(await payload.findByID({ ...dogRecord, disableErrors: true }), null)
  assert.deepEqual((await payload.findByID(record)).body, combined.body)
})


test('information Pages migration adds old-schema metadata and preserves an existing canonical user page', async () => {
  const client = createClient({ url: `file:${path.join(directory, 'old-pages.db')}` })
  try {
    await client.batch([
      'CREATE TABLE pages (id integer PRIMARY KEY, title text, slug text, body text)',
      'CREATE TABLE _pages_v (id integer PRIMARY KEY, parent_id integer, version_title text)',
      'CREATE TABLE knowledge (id integer PRIMARY KEY, slug text)',
      'CREATE TABLE payload_migrations (id integer PRIMARY KEY, name text, batch integer, updated_at text, created_at text)',
      "INSERT INTO pages VALUES (1, 'User adoption policy', 'adoption', 'User body')",
      "INSERT INTO knowledge VALUES (8, 'adoption')",
    ], 'write')
    await prepareInformationPages(client)
    for (const [table, prefix] of [['pages', ''], ['_pages_v', 'version_']]) {
      const columns = (await client.execute(`PRAGMA table_info(${table})`)).rows.map(row => row.name)
      for (const column of ['category', 'source', 'reviewer', 'reviewed_at']) assert.ok(columns.includes(`${prefix}${column}`))
    }
    assert.deepEqual((await client.execute('SELECT id, title, slug, body FROM pages')).rows, [{ id: 1, title: 'User adoption policy', slug: 'adoption', body: 'User body' }])
    assert.equal((await client.execute('SELECT count(*) AS total FROM _pages_v')).rows[0].total, 0)
    const markers = (await client.execute('SELECT * FROM payload_migrations')).rows
    assert.equal(markers.length, 1)
    assert.equal(markers[0].batch, 0)
    await client.execute("UPDATE pages SET slug = 'user-renamed-adoption'")
    await prepareInformationPages(client)
    assert.equal((await client.execute('SELECT slug FROM pages')).rows[0].slug, 'user-renamed-adoption')
    assert.deepEqual((await client.execute('SELECT * FROM payload_migrations')).rows, markers)
  } finally {
    client.close()
  }
})

test('information Pages migration copies published articles and all drafts once while preserving unrelated content', async () => {
  const client = (payload.db as unknown as SQLiteAdapter).client
  const slugs = ['adoption', 'volunteering'] as const
  const originals = new Map()
  for (const slug of slugs) {
    const { docs: [article] } = await payload.find({ collection: 'knowledge', where: { slug: { equals: slug } }, draft: false })
    const published = await payload.update({ collection: 'knowledge', id: article.id, data: { source: `Approved ${slug} source`, reviewer: 'Rescue reviewer', reviewedAt: '2026-11-17T12:00:00.000Z', _status: 'published' } })
    originals.set(slug, published)
    await payload.update({ collection: 'knowledge', id: article.id, draft: true, data: { title: `PRIVATE ${slug} draft`, slug: `${slug}-pending`, body: pageBody(`PRIVATE ${slug} body`), _status: 'draft' } })
  }
  const snapshot = async (table: string) => (await client.execute(`SELECT * FROM ${table} ORDER BY id`)).rows
  const archive = [await snapshot('knowledge'), await snapshot('_knowledge_v')]
  const standalonePages = await snapshot('pages')
  const standaloneVersions = await snapshot('_pages_v')
  const standalonePageIDs = new Set(standalonePages.map(row => row.id))
  const standaloneVersionIDs = new Set(standaloneVersions.map(row => row.id))
  const highlights = [await snapshot('homepage'), await snapshot('_homepage_v')]

  await prepareInformationPages(client)
  const pages = new Map()
  const versionColumns = 'version_title, version_slug, version_body, version__status, version_updated_at, version_created_at, created_at, updated_at, latest, version_category, version_source, version_reviewer, version_reviewed_at'
  for (const slug of slugs) {
    const original = originals.get(slug)
    const { docs: [page], totalDocs } = await payload.find({ collection: 'pages', overrideAccess: false, draft: false, where: { slug: { equals: slug } } })
    assert.equal(totalDocs, 1)
    pages.set(slug, page)
    for (const field of ['title', 'slug', 'body', '_status', 'createdAt', 'updatedAt', 'category', 'source', 'reviewer', 'reviewedAt'] as const) assert.deepEqual(page[field], original[field], `${slug}.${field}`)
    const migratedVersions = await client.execute({ sql: `SELECT ${versionColumns} FROM _pages_v WHERE parent_id = ? ORDER BY id`, args: [page.id] })
    const originalVersions = await client.execute({ sql: `SELECT ${versionColumns} FROM _knowledge_v WHERE parent_id = ? ORDER BY id`, args: [original.id] })
    assert.ok(originalVersions.rows.length > 1)
    assert.deepEqual(migratedVersions.rows, originalVersions.rows)
    const draft = await payload.findByID({ collection: 'pages', id: page.id, user: editor, overrideAccess: false, draft: true })
    assert.equal(draft.title, `PRIVATE ${slug} draft`)
    assert.equal(richTextToText(draft.body), `PRIVATE ${slug} body`)
    const publicRead = await payload.findByID({ collection: 'pages', id: page.id, overrideAccess: false, draft: false })
    assert.ok(!JSON.stringify(publicRead).includes('PRIVATE'))
    assert.equal((await payload.find({ collection: 'pages', overrideAccess: false, draft: true, where: { slug: { equals: `${slug}-pending` } } })).totalDocs, 0)
  }
  const migrated = [await snapshot('pages'), await snapshot('_pages_v'), await snapshot('payload_migrations')]
  await prepareInformationPages(client)
  assert.deepEqual([await snapshot('pages'), await snapshot('_pages_v'), await snapshot('payload_migrations')], migrated)

  const adoption = pages.get('adoption')
  await payload.update({ collection: 'pages', id: adoption.id, user: editor, overrideAccess: false, data: { title: 'Editor policy', slug: 'adoption-editorial', body: pageBody('Editor published body'), _status: 'published' } })
  await payload.update({ collection: 'pages', id: adoption.id, user: editor, overrideAccess: false, draft: true, data: { title: 'Editor pending policy', body: pageBody('Editor pending body'), _status: 'draft' } })
  await payload.delete({ collection: 'pages', id: pages.get('volunteering').id, user: editor, overrideAccess: false })
  const editorial = [await snapshot('pages'), await snapshot('_pages_v'), await snapshot('payload_migrations')]
  await prepareInformationPages(client)
  assert.deepEqual([await snapshot('pages'), await snapshot('_pages_v'), await snapshot('payload_migrations')], editorial)
  assert.equal((await payload.find({ collection: 'pages', where: { slug: { in: [...slugs] } }, draft: false })).totalDocs, 0)
  assert.equal((await payload.findByID({ collection: 'pages', id: adoption.id, draft: false })).title, 'Editor policy')
  assert.equal((await payload.findByID({ collection: 'pages', id: adoption.id, draft: true })).title, 'Editor pending policy')
  assert.deepEqual((await snapshot('pages')).filter(row => standalonePageIDs.has(row.id)), standalonePages)
  assert.deepEqual((await snapshot('_pages_v')).filter(row => standaloneVersionIDs.has(row.id)), standaloneVersions)
  assert.deepEqual([await snapshot('knowledge'), await snapshot('_knowledge_v')], archive)
  assert.deepEqual([await snapshot('homepage'), await snapshot('_homepage_v')], highlights)
})
