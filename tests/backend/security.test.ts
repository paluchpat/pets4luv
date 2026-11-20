import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalReq, getPayload, ValidationError, type Payload } from 'payload'
import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { createClient } from '@libsql/client'
import { animalDTO, animalProfileDTO, buildAnimalWhere, homepageIntroDTO, richTextToText } from '../../src/lib/public-content'
import { seedAdoption } from '../../scripts/adoption-seed'
import { seedPages } from '../../scripts/page-seeds'
import { seedVolunteering } from '../../scripts/volunteering-seed'
import { prepareHomepageIntro } from '../../scripts/homepage-intro-schema'
import { seedPoppyPhotos } from '../../scripts/poppy-photos-seed'
import { seedDemoCalico } from '../../scripts/demo-calico-seed'
import { prepareWebsiteSettings } from '../../scripts/website-settings-schema'
import { seedWebsiteSettings } from '../../scripts/website-settings-seed'
import { applyWebsiteSettings, defaultWebsiteSettings, websiteSettingsDTO } from '../../src/lib/website-settings'
import { prepareMainMenuSchema } from '../../scripts/main-menu-schema'
import { seedMainMenu } from '../../scripts/main-menu-seed'
import { mainMenuDTO } from '../../src/lib/main-menu'
import { loadAdminGalleryCards, loadAdminGalleryPageCards } from '../../src/components/admin/gallery-data'
import { resolveRichTextLinks } from '../../src/lib/rich-text-links'
import { publishFeaturedDraft, saveCatministratorDraft, undoFeaturedPublication } from '../../src/lib/catministrator/drafts'
import { savePhotoDraft } from '../../src/lib/catministrator/photo-drafts'
import { latestFeaturedVersion, previewFeaturedAnimals } from '../../src/lib/catministrator/featured-review'
import { linkedTelegramEditor } from '../../src/lib/catministrator/editors'
import { prepareTelegramUsers } from '../../scripts/telegram-users-schema'
import { AnimalNameError, correctAnimalReference, parseDraftCommand } from '../../src/lib/catministrator/requests'
import { discardFeaturedDraft } from '../../src/lib/discard-featured-draft'
import { validatePageSlug } from '../../src/collections/Pages'

let payload: Payload
let directory: string
let admin: any
let editor: any
let draftID: number
let publishedID: number
let publicPhotoID: number
before(async () => {
  // Tests must never inherit hosted credentials or migration flags from a developer's .env.
  for (const name of ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'BLOB_READ_WRITE_TOKEN', 'TURSO_PUSH_SCHEMA', 'VERCEL', 'VERCEL_ENV', 'PAYLOAD_MIGRATING']) delete process.env[name]
  process.env.DISABLE_PAYLOAD_HMR = 'true'
  directory = await mkdtemp(path.join(os.tmpdir(), 'pets4luv-security-'))
  process.env.DATABASE_URL = `file:${path.join(directory, 'test.db')}`
  process.env.LOCAL_UPLOAD_DIR = path.join(directory, 'uploads')
  const { default: config } = await import('../../src/payload.config')
  const resolvedConfig = await config
  payload = await getPayload({ config: { ...resolvedConfig, typescript: { ...resolvedConfig.typescript, autoGenerate: false } } })
  admin = await payload.create({ collection: 'users', data: { email: 'admin@example.invalid', password: 'Temporary-test-only-88327', name: 'Test Admin', role: 'admin' } })
  editor = await payload.create({ collection: 'users', overrideAccess: false, user: admin, data: { email: 'editor@example.invalid', password: 'Temporary-test-only-99236', name: 'Test Editor', role: 'editor' } })
  publicPhotoID = (await payload.create({ collection: 'media', data: { alt: 'Approved test fixture' }, filePath: path.resolve('public/images/luna.png') })).id
  const basic = { name: 'Fixture', slug: 'published-fixture', species: 'cat' as const, sex: 'female' as const, ageGroup: 'adult' as const, size: 'small' as const, summary: 'Fictional fixture', description: 'Fictional fixture', status: 'available' as const, internalNotes: 'PRIVATE SENTINEL', rescueIntakeID: 'PRIVATE-1', photos: [{ photo: publicPhotoID }], compatibility: { dogs: 'unknown' as const, cats: 'yes' as const, children: 'conditional' as const } }
  publishedID = (await payload.create({ collection: 'animals', data: { ...basic, colors: ['black', 'white'], _status: 'published' } })).id
  draftID = (await payload.create({ collection: 'animals', draft: true, data: { ...basic, colors: ['gray'], slug: 'secret-draft', rescueIntakeID: 'PRIVATE-2', _status: 'draft' } })).id
})
after(async () => {
  if (payload) {
    const client = (payload.db as unknown as SQLiteAdapter).client
    await payload.destroy()
    client.close()
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

test('public phrase search combines exact traits with public profile text and filters', async () => {
  const search = async (q: string, filters = {}) => (await payload.find({
    collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ ...filters, q }),
  })).docs.map(doc => doc.id)

  assert.deepEqual(await search('show me a small BLACK female cat'), [publishedID])
  assert.deepEqual(await search('small black cat or senior dog'), [publishedID])
  assert.deepEqual(await search('black Fixture'), [publishedID])
  assert.deepEqual(await search('cat good with cats'), [publishedID])
  assert.deepEqual(await search('cat good with children'), [])
  assert.deepEqual(await search('black cat', { sex: 'male' }), [])
  assert.deepEqual(await search('grey cat'), [])
  assert.deepEqual(await search('"PRIVATE SENTINEL" or PRIVATE-1'), [])
})

test('Calico, Tortoiseshell, and Tuxedo can be saved and searched through public and CMS animal filters', async () => {
  for (const color of ['calico', 'tortoiseshell', 'tuxedo'] as const) {
    const animal = await payload.create({ collection: 'animals', overrideAccess: false, user: editor, data: {
      name: 'Coat pattern fixture', slug: color + '-coat-pattern-fixture', species: 'cat', sex: 'female', ageGroup: 'adult', size: 'small',
      colors: [color, 'white'], description: 'Animal color filter fixture.', status: 'available',
      compatibility: { dogs: 'unknown', cats: 'unknown', children: 'unknown' },
      photos: [{ photo: publicPhotoID }], _status: 'published',
    } })
    try {
      assert.deepEqual(animal.colors, [color, 'white'])
      const visible = await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ species: 'cat', color }) })
      assert.deepEqual(visible.docs.map(doc => doc.id), [animal.id])
      const phrase = 'small ' + color + ' cat "filter fixture"'
      assert.deepEqual((await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ q: phrase }) })).docs.map(doc => doc.id), [animal.id])
      assert.equal((await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ q: '"fixture filter"' }) })).totalDocs, 0)
      const searched = await loadAdminGalleryPageCards(payload, editor, { search: color + ' cat', page: 1, limit: 12 })
      assert.deepEqual(searched.map(card => card.id), [animal.id])
      await payload.update({ collection: 'animals', id: animal.id, overrideAccess: false, user: editor, data: { status: 'on-hold' } })
      assert.equal((await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ color, q: phrase }) })).totalDocs, 0)
    } finally {
      await payload.delete({ collection: 'animals', id: animal.id })
    }
  }
})

test('the reviewed Calico sample upgrade preserves drafts, real animals, and later editor changes', async () => {
  const sample = await payload.create({ collection: 'animals', data: {
    name: 'Olive', slug: 'olive', species: 'cat', sex: 'female', ageGroup: 'adult', size: 'small',
    colors: ['brown', 'orange', 'black', 'cream'], description: 'Keep this description.', status: 'available',
    photos: [{ photo: publicPhotoID }], compatibility: { dogs: 'unknown', cats: 'unknown', children: 'unknown' },
    internalNotes: 'Real rescue record', _status: 'published',
  } })
  let reviewedPhoto: number | undefined
  try {
    assert.equal(await seedDemoCalico(payload), 0)
    await payload.update({ collection: 'animals', id: sample.id, data: { internalNotes: 'Fictional demonstration record. Never use this fixture as an actual adoption listing.' } })
    assert.equal(await seedDemoCalico(payload), 0, 'A different photo must not be classified from the name alone.')
    reviewedPhoto = (await payload.create({ collection: 'media', data: { alt: 'Olive, fictional demo animal' }, filePath: path.resolve('public/images/olive.png') })).id
    await payload.update({ collection: 'animals', id: sample.id, data: { photos: [{ photo: reviewedPhoto }] } })
    await payload.update({ collection: 'animals', id: sample.id, draft: true, data: { summary: 'Pending editorial change', _status: 'draft' } })
    assert.equal(await seedDemoCalico(payload), 0)
    await payload.update({ collection: 'animals', id: sample.id, data: { _status: 'published' } })
    assert.equal(await seedDemoCalico(payload), 1)
    const updated = await payload.findByID({ collection: 'animals', id: sample.id, depth: 0 })
    assert.deepEqual(updated.colors, ['brown', 'orange', 'black', 'cream', 'calico'])
    assert.equal(updated.description, 'Keep this description.')
    assert.equal(updated.summary, 'Pending editorial change')
    assert.equal(updated.photos[0].photo, reviewedPhoto)
    assert.equal(await seedDemoCalico(payload), 0)
    await payload.update({ collection: 'animals', id: sample.id, data: { colors: ['orange'] } })
    assert.equal(await seedDemoCalico(payload), 0)
    assert.deepEqual((await payload.findByID({ collection: 'animals', id: sample.id })).colors, ['orange'])
  } finally {
    await payload.delete({ collection: 'animals', id: sample.id })
    if (reviewedPhoto) await payload.delete({ collection: 'media', id: reviewedPhoto })
    await (payload.db as unknown as SQLiteAdapter).client.execute({ sql: 'DELETE FROM payload_migrations WHERE name = ?', args: ['20261117_olive_demo_calico'] })
  }
})

test('retired prototype collections are absent and animal edits still require staff', async () => {
  for (const slug of ['intakes', 'intake-files', 'knowledge']) assert.ok(!(slug in payload.collections))
  await assert.rejects(() => payload.update({ collection: 'animals', id: publishedID, data: { name: 'Anonymous edit' }, overrideAccess: false }))
})

test('editor cannot create users or escalate their own role', async () => {
  await assert.rejects(() => payload.create({ collection: 'users', user: editor, overrideAccess: false, data: { email: 'intruder@example.invalid', password: 'Temporary-test-only-81336', name: 'Intruder', role: 'admin' } }))
  await payload.update({ collection: 'users', id: editor.id, user: editor, overrideAccess: false, data: { role: 'admin', name: 'Still an editor' } })
  const persisted = await payload.findByID({ collection: 'users', id: editor.id })
  assert.equal(persisted.role, 'editor')
})

test('Telegram links are unique and only administrators can manage them', async () => {
  const id = '9000000001'
  const update = (user: typeof admin, telegramUserId: string | null) => payload.update({
    collection: 'users', id: editor.id, user, overrideAccess: false, data: { telegramUserId },
  })
  await assert.rejects(() => update(admin, '@username'), /validation/i)
  await update(editor, id)
  assert.equal(await linkedTelegramEditor(payload, Number(id), Number.MAX_SAFE_INTEGER), undefined)

  const linked = await update(admin, ' ' + id + ' ')
  assert.equal(linked.telegramUserId, id)
  const linkedAt = Math.floor(Date.parse(linked.telegramLinkedAt!) / 1000)
  assert.equal((await linkedTelegramEditor(payload, Number(id), linkedAt))?.id, editor.id)
  assert.equal(await linkedTelegramEditor(payload, Number(id), linkedAt - 1), undefined)
  await assert.rejects(() => payload.update({
    collection: 'users', id: admin.id, user: admin, overrideAccess: false, data: { telegramUserId: id },
  }), /validation/i)

  const ownUser = await update(editor, '9000000002')
  assert.equal(ownUser.telegramUserId, undefined)
  assert.equal(ownUser.telegramLinkedAt, undefined)
  assert.equal((await linkedTelegramEditor(payload, Number(id), linkedAt))?.id, editor.id)

  await update(admin, '')
  assert.equal(await linkedTelegramEditor(payload, Number(id), Number.MAX_SAFE_INTEGER), undefined)
})

test('legacy Telegram links migrate once and clearing one prevents reimport', async () => {
  const legacy = path.join(directory, 'telegram-editors')
  await mkdir(legacy)
  const id = '9000000003'
  await writeFile(path.join(legacy, id + '.json'), JSON.stringify({ editor: 1, linkedAt: 1234 }))
  const client = createClient({ url: 'file:' + path.join(directory, 'old-users.db') })
  try {
    await client.batch([
      'CREATE TABLE users (id integer PRIMARY KEY, role text)',
      "INSERT INTO users VALUES (1, 'admin'), (2, 'editor')",
    ], 'write')
    await prepareTelegramUsers(client, legacy)
    const { rows: [user] } = await client.execute('SELECT * FROM users WHERE id = 1')
    assert.equal(user.telegram_user_id, id)
    assert.equal(user.telegram_linked_at, new Date(1234000).toISOString())
    await client.execute('UPDATE users SET telegram_user_id = NULL, telegram_linked_at = NULL WHERE id = 1')
    await prepareTelegramUsers(client, legacy)
    assert.equal((await client.execute('SELECT telegram_user_id FROM users WHERE id = 1')).rows[0].telegram_user_id, null)
  } finally {
    client.close()
  }
})

test('the homepage rejects a fourth featured animal on draft and published saves', async () => {
  for (const draft of [true, false]) {
    await assert.rejects(() => payload.updateGlobal({
      slug: 'homepage', draft, overrideAccess: false, user: editor,
      data: {
        heading: 'Too many featured animals',
        intro: pageBody('Featured introduction'),
        featuredAnimals: Array.from({ length: 4 }, () => ({ animal: publishedID })),
        _status: draft ? 'draft' : 'published',
      },
    }), error => error instanceof ValidationError &&
      error.data.errors.some(field => field.path === 'featuredAnimals'))
  }
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
  const expectedText = 'We are a registered 501(c)(3) nonprofit organization and a volunteer-run, no-kill cat and dog rescue in Freeport, New York. We rescue, rehabilitate, and rehome animals, with a focus on seniors and animals who are injured, ill, disabled, or have other special needs. We give them a safe place to rest and recover at their own pace.\n\nWe rely on your donations to give animals the care they need and the chance to find a loving home.'
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

test('staff can create animal profiles directly, save drafts, publish and update adoption status', async () => {
  const draft = await payload.create({ collection: 'animals', user: editor, overrideAccess: false, draft: true, data: { name: 'Manual fixture', slug: 'manual-fixture', rescueIntakeID: 'MANUAL-TEST-1', species: 'dog', sex: 'unknown', ageGroup: 'adult', size: 'medium', summary: 'Human supplied', description: 'Human reviewed description.', photos: [{ photo: publicPhotoID }], status: 'available', _status: 'draft' } })
  await assert.rejects(() => payload.findByID({ collection: 'animals', id: draft.id, overrideAccess: false }))
  await payload.update({ collection: 'animals', id: draft.id, user: editor, overrideAccess: false, data: { _status: 'published' } })
  assert.equal((await payload.findByID({ collection: 'animals', id: draft.id, overrideAccess: false })).name, 'Manual fixture')
  await payload.update({ collection: 'animals', id: draft.id, user: editor, overrideAccess: false, data: { status: 'adopted' } })
  const available = await payload.find({ collection: 'animals', overrideAccess: false, where: buildAnimalWhere({ q: 'Manual fixture' }) })
  assert.equal(available.totalDocs, 0)
  assert.equal((await payload.findByID({ collection: 'animals', id: draft.id, overrideAccess: false })).status, 'adopted')
})


test('optional animal weight accepts decimal numbers, rejects invalid values, and can be cleared', async () => {
  for (const weight of [12.75, 0.625, 0]) {
    const updated = await payload.update({ collection: 'animals', id: publishedID, overrideAccess: false, user: editor, data: { weight } })
    assert.equal(updated.weight, weight)
    assert.equal(animalProfileDTO(updated).weight, weight)
  }
  for (const weight of ['heavy', '12lb', -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(() => payload.update({ collection: 'animals', id: publishedID, overrideAccess: false, user: editor, data: { weight: weight as any } }))
  }
  const cleared = await payload.update({ collection: 'animals', id: publishedID, overrideAccess: false, user: editor, data: { weight: null } })
  assert.equal(cleared.weight, null)
  assert.equal(animalProfileDTO(cleared).weight, null)
  for (const weight of [undefined, null, '', '12lb', -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(animalProfileDTO({ photos: [], weight }).weight, null)
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
  assert.deepEqual(await seedPages(payload), { created: ['contact', 'about', 'tnr', 'medical', 'injured-feral-cats'] })
  assert.deepEqual(await seedPages(payload), { created: [] })
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
  assert.ok(JSON.stringify(about.body).includes('{{phoneHref}}'))
  const aboutBody = JSON.stringify(applyWebsiteSettings(about.body, defaultWebsiteSettings))
  for (const href of ['tel:+15168607057', 'mailto:info@pets4luv.org', '/animals']) assert.ok(aboutBody.includes(href))
  for (const [slug, title] of Object.entries({ tnr: 'Trap-Neuter-Return (TNR)', medical: 'Medical Assistance', 'injured-feral-cats': 'Injured Feral Cats' })) {
    const { docs: [page] } = await payload.find({ collection: 'pages', overrideAccess: false, where: { slug: { equals: slug } } })
    assert.equal(page?.title, title)
    assert.equal(page._status, 'published')
    const content = JSON.stringify(applyWebsiteSettings(page.body, defaultWebsiteSettings))
    assert.ok(content.includes('tel:+15168607057'))
    assert.ok(content.includes('mailto:info@pets4luv.org'))
  }
  assert.equal((await payload.count({ collection: 'animals' })).totalDocs, beforeAnimals.totalDocs)
  assert.equal((await payload.count({ collection: 'users' })).totalDocs, beforeUsers.totalDocs)
})

test('information seeds use Pages directly and preserve published edits and renamed drafts', async () => {
  assert.deepEqual(await seedAdoption(payload), { adoption: 'created' })
  assert.equal(await seedVolunteering(payload), 'created')
  for (const slug of ['adoption', 'volunteering']) {
    const { docs: [page] } = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, draft: false })
    assert.ok(page.body.root.children.length)
    if (slug === 'adoption') {
      assert.match(richTextToText(page.body), /Cat adoption/)
      assert.match(richTextToText(page.body), /Dog adoption/)
    }
    await payload.update({ collection: 'pages', id: page.id, data: { title: 'Approved editorial title', body: pageBody('Approved editorial copy'), _status: 'published' } })
    await payload.update({ collection: 'pages', id: page.id, draft: true, data: { title: 'Pending editorial title', slug: `${slug}-draft`, _status: 'draft' } })
    assert.equal(slug === 'adoption' ? (await seedAdoption(payload)).adoption : await seedVolunteering(payload), 'preserved')
    assert.equal((await payload.findByID({ collection: 'pages', id: page.id, draft: false })).title, 'Approved editorial title')
    assert.equal((await payload.findByID({ collection: 'pages', id: page.id, draft: true })).title, 'Pending editorial title')
  }
})

test('profile photos include all approved images without exposing media metadata', () => {
  const profile = animalProfileDTO({ name: 'Poppy', photos: [
    { photo: { url: '/api/media/file/original.webp', alt: 'Original', sizes: { card: { url: '/cropped.webp' } }, private: 'PRIVATE PHOTO FIELD' } },
    { photo: { url: '/api/media/file/playing.webp', alt: 'Playing', private: 'PRIVATE PHOTO FIELD' } },
    { photo: 42 }, { photo: null },
  ] })
  assert.deepEqual(profile.photos, [
    { url: '/api/media/file/original.webp', alt: 'Original' },
    { url: '/api/media/file/playing.webp', alt: 'Playing' },
  ])
  assert.equal(profile.photo?.url, profile.photos[0].url)
  assert.ok(!JSON.stringify(profile).includes('PRIVATE PHOTO FIELD'))
})

test('Poppy photo addition preserves existing content and runs once without publishing drafts', async () => {
  const data = { name: 'Poppy', slug: 'poppy', species: 'cat', sex: 'female', ageGroup: 'baby', size: 'small', status: 'available', summary: 'Rescue approved summary', description: 'Rescue approved description', compatibility: { dogs: 'unknown', cats: 'unknown', children: 'unknown' }, photos: [{ photo: publicPhotoID }], internalNotes: 'Real rescue listing', _status: 'published' } as const
  const poppy = await payload.create({ collection: 'animals', data: { ...data, photos: [...data.photos] } })
  const mediaBefore = await payload.count({ collection: 'media' })
  assert.equal(await seedPoppyPhotos(payload), 0)
  assert.deepEqual(await payload.count({ collection: 'media' }), mediaBefore)

  await payload.update({ collection: 'animals', id: poppy.id, draft: true, data: { internalNotes: 'Fictional demonstration record. Never use this fixture as an actual adoption listing.', summary: 'Pending draft', _status: 'draft' } })
  assert.equal(await seedPoppyPhotos(payload), 0)
  assert.equal((await payload.findByID({ collection: 'animals', id: poppy.id, draft: true })).summary, 'Pending draft')
  assert.deepEqual(await payload.count({ collection: 'media' }), mediaBefore)

  await payload.update({ collection: 'animals', id: poppy.id, data: { summary: data.summary, _status: 'published' } })
  const unrelated = await payload.findByID({ collection: 'animals', id: publishedID, depth: 0 })
  assert.equal(await seedPoppyPhotos(payload), 5)
  const updated = await payload.findByID({ collection: 'animals', id: poppy.id, depth: 0 })
  assert.equal(updated.photos?.length, 6)
  assert.equal(updated.photos?.[0].photo, publicPhotoID)
  assert.equal(updated.summary, data.summary)
  assert.equal(updated.description, data.description)
  assert.deepEqual(await payload.findByID({ collection: 'animals', id: publishedID, depth: 0 }), unrelated)
  const count = await payload.count({ collection: 'media' })
  assert.equal(await seedPoppyPhotos(payload), 0)
  assert.deepEqual(await payload.count({ collection: 'media' }), count)
  assert.deepEqual(await payload.findByID({ collection: 'animals', id: poppy.id, depth: 0 }), updated)

  // A later editorial removal must not be reversed by the next deployment.
  await payload.update({ collection: 'animals', id: poppy.id, data: { photos: [updated.photos![0]], _status: 'published' } })
  assert.equal(await seedPoppyPhotos(payload), 0)
  assert.equal((await payload.findByID({ collection: 'animals', id: poppy.id, depth: 0 })).photos?.length, 1)

  // Upgrading a site with the first photo batch completed only appends the three new photos.
  // It must not restore older images an editor has removed, or upload duplicate media.
  await (payload.db as unknown as SQLiteAdapter).client.execute({ sql: 'DELETE FROM payload_migrations WHERE name = ?', args: ['20261117_poppy_three_more_demo_photos'] })
  assert.equal(await seedPoppyPhotos(payload), 3)
  const upgraded = await payload.findByID({ collection: 'animals', id: poppy.id, depth: 0 })
  assert.deepEqual(upgraded.photos?.map(row => row.photo), [publicPhotoID, ...updated.photos!.slice(3).map(row => row.photo)])
  assert.deepEqual(await payload.count({ collection: 'media' }), count)
  assert.equal(await seedPoppyPhotos(payload), 0)
})


test('Website Settings schema initializes current details once and preserves published edits and drafts', async () => {
  const client = (payload.db as unknown as SQLiteAdapter).client
  const unrelated = async () => [
    (await client.execute('SELECT * FROM homepage ORDER BY id')).rows,
    (await client.execute('SELECT * FROM pages ORDER BY id')).rows,
    (await client.execute('SELECT * FROM animals ORDER BY id')).rows,
  ]
  const before = await unrelated()
  await client.batch(['DROP TABLE _website_settings_v', 'DROP TABLE website_settings'], 'write')
  await prepareWebsiteSettings(client)
  const initial = await payload.findGlobal({ slug: 'website-settings', overrideAccess: false, draft: false })
  assert.equal(initial._status, 'published')
  assert.deepEqual(websiteSettingsDTO(initial), defaultWebsiteSettings)
  assert.equal((await payload.findGlobalVersions({ slug: 'website-settings' })).totalDocs, 1)

  await assert.rejects(() => payload.updateGlobal({ slug: 'website-settings', overrideAccess: false, data: { phone: '212-555-0100' } }))
  await assert.rejects(() => payload.findGlobalVersions({ slug: 'website-settings', overrideAccess: false }))
  await assert.rejects(() => payload.updateGlobal({ slug: 'website-settings', overrideAccess: false, user: editor, data: { instagramUrl: 'javascript:alert(1)', _status: 'published' } }))
  await assert.rejects(() => payload.updateGlobal({ slug: 'website-settings', overrideAccess: false, user: editor, data: { emailAddress: 'not an email', _status: 'published' } }))
  await assert.rejects(() => payload.updateGlobal({ slug: 'website-settings', overrideAccess: false, user: editor, data: { paypalHandle: 'https://paypal.me/example', _status: 'published' } }))

  await payload.updateGlobal({ slug: 'website-settings', overrideAccess: false, user: editor, data: { address: '10 Example Road, Freeport, NY 11520', phone: '212-555-0100', emailAddress: 'hello@example.invalid', tiktokUrl: 'https://www.tiktok.com/@example', instagramUrl: '', venmoHandle: '@rescue-example', paypalHandle: '@RescueFoundation', _status: 'published' } })
  await payload.updateGlobal({ slug: 'website-settings', overrideAccess: false, user: editor, data: { phone: '212-555-0111', _status: 'published' } })
  const published = await payload.findGlobal({ slug: 'website-settings', overrideAccess: false, draft: false })
  assert.equal(published.venmoHandle, 'rescue-example')
  assert.equal(published.paypalHandle, 'RescueFoundation')
  assert.equal(websiteSettingsDTO(published).paypalUrl, 'https://www.paypal.com/paypalme/RescueFoundation')
  assert.equal(websiteSettingsDTO(published).instagramUrl, '')
  await payload.updateGlobal({ slug: 'website-settings', overrideAccess: false, user: editor, draft: true, data: { emailAddress: 'PRIVATE-DRAFT@example.invalid', _status: 'draft' } })
  for (const draft of [false, true]) {
    const visitor = await payload.findGlobal({ slug: 'website-settings', overrideAccess: false, draft })
    assert.equal(visitor.emailAddress, published.emailAddress)
    assert.ok(!JSON.stringify(visitor).includes('PRIVATE-DRAFT'))
  }
  const pending = await payload.findGlobal({ slug: 'website-settings', overrideAccess: false, user: editor, draft: true })
  assert.equal(pending.emailAddress, 'PRIVATE-DRAFT@example.invalid')

  const rows = async () => [
    (await client.execute('SELECT * FROM website_settings ORDER BY id')).rows,
    (await client.execute('SELECT * FROM _website_settings_v ORDER BY id')).rows,
  ]
  const snapshot = await rows()
  await prepareWebsiteSettings(client)
  assert.equal(await seedWebsiteSettings(payload), false)
  assert.deepEqual(await rows(), snapshot)
  assert.deepEqual(await unrelated(), before)

  // Simulate the old URL-only schema, including a deliberately disabled draft link.
  await client.batch([
    'ALTER TABLE website_settings ADD COLUMN paypal_url text',
    'ALTER TABLE _website_settings_v ADD COLUMN version_paypal_url text',
    "UPDATE website_settings SET paypal_url = 'https://paypal.me/CurrentRescue'",
    "UPDATE _website_settings_v SET version_paypal_url = CASE WHEN version__status = 'draft' THEN '' ELSE 'https://www.paypal.com/paypalme/SavedRescue' END",
    'ALTER TABLE website_settings DROP COLUMN paypal_handle',
    'ALTER TABLE _website_settings_v DROP COLUMN version_paypal_handle',
  ], 'write')
  await prepareWebsiteSettings(client)
  const converted = await client.execute('SELECT paypal_handle FROM website_settings')
  assert.equal(converted.rows[0].paypal_handle, 'CurrentRescue')
  const versions = await client.execute('SELECT version_paypal_handle, version__status FROM _website_settings_v')
  assert.ok(versions.rows.some(row => row.version__status === 'draft'))
  for (const row of versions.rows) assert.equal(row.version_paypal_handle, row.version__status === 'draft' ? '' : 'SavedRescue')
  // Clearing a newly saved handle must never restore the archived URL on later builds.
  await client.execute("UPDATE website_settings SET paypal_handle = ''")
  const upgradedSnapshot = await rows()
  await prepareWebsiteSettings(client)
  assert.deepEqual(await rows(), upgradedSnapshot)
  assert.deepEqual(await unrelated(), before)
})


test('Main Menu bootstrap adds only its storage, seeds relationships once and preserves published edits and drafts', async () => {
  const client = (payload.db as unknown as SQLiteAdapter).client
  const snapshot = async (table: string) => (await client.execute(`SELECT * FROM ${table} ORDER BY id`)).rows
  const tableNames = async () => (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).rows.map(row => row.name)
  const unrelated = async () => Promise.all(['pages', '_pages_v', 'homepage', '_homepage_v', 'website_settings', '_website_settings_v', 'animals'].map(snapshot))
  const before = await unrelated()
  const menuTables = ['main_menu_items_children', 'main_menu_items', 'main_menu', '_main_menu_v_version_items_children', '_main_menu_v_version_items', '_main_menu_v']
  // This database is the disposable mkdtemp fixture created in the suite's before hook.
  await client.batch(menuTables.map(table => 'DROP TABLE ' + table), 'write')
  const oldTables = await tableNames()
  await prepareMainMenuSchema(client)
  assert.deepEqual(await tableNames(), [...oldTables, ...menuTables].sort())
  assert.equal(await seedMainMenu(payload), true)
  const initial = await payload.findGlobal({ slug: 'main-menu', overrideAccess: false, draft: false, depth: 0 })
  assert.equal(initial._status, 'published')
  assert.equal(initial.items?.length, 5)
  assert.equal(initial.items?.[0].builtIn, 'home')
  assert.equal(initial.items?.find(item => item.label === 'About us')?.linkType, 'page')
  assert.equal((await payload.findGlobalVersions({ slug: 'main-menu' })).totalDocs, 1)
  const initialRows = await Promise.all(menuTables.map(snapshot))
  await prepareMainMenuSchema(client)
  assert.equal(await seedMainMenu(payload), false)
  assert.deepEqual(await Promise.all(menuTables.map(snapshot)), initialRows)

  await assert.rejects(() => payload.updateGlobal({ slug: 'main-menu', overrideAccess: false, data: { items: [] } }))
  await assert.rejects(() => payload.findGlobalVersions({ slug: 'main-menu', overrideAccess: false }))
  await assert.rejects(() => payload.updateGlobal({ slug: 'main-menu', overrideAccess: false, user: editor, data: { items: [{ label: 'Unsafe', linkType: 'custom', url: 'javascript:alert(1)' }], _status: 'published' } }))
  await assert.rejects(() => payload.updateGlobal({ slug: 'main-menu', overrideAccess: false, user: editor, data: { items: [{ label: 'Missing page', linkType: 'page' }], _status: 'published' } }))
  await assert.rejects(() => payload.updateGlobal({ slug: 'main-menu', overrideAccess: false, user: editor, data: { items: [{ label: 'Empty submenu', linkType: 'submenu', children: [] }], _status: 'published' } }))
  const about = initial.items!.find(item => item.label === 'About us')!
  await payload.updateGlobal({ slug: 'main-menu', overrideAccess: false, user: editor, data: { items: [
    { label: 'Visit our partner', linkType: 'custom', url: 'https://example.org', newTab: true, showInFooter: true },
    { ...about, label: 'Our rescue' },
    { label: 'More', linkType: 'submenu', children: [{ label: 'Gallery', linkType: 'builtIn', builtIn: 'animals' }] },
  ], highlightedButton: { enabled: false }, _status: 'published' } })
  const published = await payload.findGlobal({ slug: 'main-menu', overrideAccess: false, draft: false, depth: 0 })
  assert.deepEqual(published.items?.map(item => item.label), ['Visit our partner', 'Our rescue', 'More'])
  assert.equal(published.highlightedButton?.enabled, false)
  await payload.updateGlobal({ slug: 'main-menu', overrideAccess: false, user: editor, draft: true, data: { items: [{ label: 'PRIVATE MENU DRAFT', linkType: 'custom', url: '/private-draft' }], _status: 'draft' } })
  for (const draft of [false, true]) {
    const visitor = await payload.findGlobal({ slug: 'main-menu', overrideAccess: false, draft, depth: 0 })
    assert.deepEqual(visitor.items, published.items)
    assert.ok(!JSON.stringify(visitor).includes('PRIVATE'))
  }
  const pending = await payload.findGlobal({ slug: 'main-menu', overrideAccess: false, user: editor, draft: true, depth: 0 })
  assert.equal(mainMenuDTO(pending, [], true).items[0].label, 'PRIVATE MENU DRAFT')
  const editorialRows = await Promise.all(menuTables.map(snapshot))
  await prepareMainMenuSchema(client)
  assert.equal(await seedMainMenu(payload), false)
  assert.deepEqual(await Promise.all(menuTables.map(snapshot)), editorialRows)

  await payload.updateGlobal({ slug: 'main-menu', overrideAccess: false, user: editor, data: { items: [], highlightedButton: { enabled: false }, _status: 'published' } })
  assert.equal(await seedMainMenu(payload), false)
  const empty = await payload.findGlobal({ slug: 'main-menu', overrideAccess: false, draft: false })
  assert.deepEqual(mainMenuDTO(empty), { items: [], button: null, footerLinks: [] })
  assert.deepEqual(await unrelated(), before)
})


test('admin animal gallery protects drafts and projects only the selected staff cards', async () => {
  assert.deepEqual(await loadAdminGalleryCards(payload, undefined, [publishedID, draftID]), [])
  assert.deepEqual(await loadAdminGalleryCards(payload, null, [publishedID, draftID]), [])
  assert.deepEqual(await loadAdminGalleryCards(payload, editor, []), [])
  await payload.updateGlobal({ slug: 'homepage', overrideAccess: false, user: editor, data: { heading: 'Gallery fixture', intro: pageBody('Published gallery fixture'), featuredAnimals: [{ animal: publishedID }], _status: 'published' } })
  await payload.updateGlobal({ slug: 'homepage', overrideAccess: false, user: editor, draft: true, data: { featuredAnimals: [{ animal: draftID }], _status: 'draft' } })
  await payload.update({ collection: 'animals', id: publishedID, overrideAccess: false, user: editor, draft: true, data: { name: 'PRIVATE GALLERY CHANGE', _status: 'draft' } })
  const cards = await loadAdminGalleryCards(payload, editor, [draftID, publishedID])
  assert.deepEqual(cards.map(card => card.id), [draftID, publishedID])
  assert.equal(cards[0].publication, 'draft')
  assert.equal(cards[1].publication, 'changed')
  assert.equal(cards[1].name, 'PRIVATE GALLERY CHANGE')
  assert.ok(cards[1].photo?.url)
  assert.equal(cards[1].photos, 1)
  assert.equal(cards[1].featured, true)
  assert.equal(cards[0].featured, false)
  const encoded = JSON.stringify(cards)
  assert.ok(!encoded.includes('PRIVATE SENTINEL'))
  assert.ok(!encoded.includes('PRIVATE-1'))
  assert.ok(!encoded.includes('internalNotes'))
  assert.ok(!encoded.includes('rescueIntakeID'))
  const publicRecord = await payload.findByID({ collection: 'animals', id: publishedID, overrideAccess: false, draft: false })
  assert.equal(publicRecord.name, 'Fixture')

  // More recent profiles must not push the featured animal off the first page or dashboard.
  const recentIDs: number[] = []
  for (let index = 0; index < 6; index++) {
    const recent = await payload.create({ collection: 'animals', overrideAccess: false, user: editor, draft: true,
      data: { name: `Recent gallery fixture ${index}`, _status: 'draft' } as any,
    })
    recentIDs.push(recent.id)
  }
  const scope = { id: { in: [publishedID, draftID, ...recentIDs] } }
  const first = await loadAdminGalleryPageCards(payload, editor, { where: scope, page: 1, limit: 3 })
  assert.equal(first[0].id, publishedID)
  assert.equal(first[0].featured, true)
  assert.deepEqual(first.slice(1).map(card => card.id), [...recentIDs].reverse().slice(0, 2))
  const rest = [
    ...await loadAdminGalleryPageCards(payload, editor, { where: scope, page: 2, limit: 3 }),
    ...await loadAdminGalleryPageCards(payload, editor, { where: scope, page: 3, limit: 3 }),
  ]
  const allIDs = [...first, ...rest].map(card => card.id)
  assert.equal(new Set(allIDs).size, 8)
  assert.deepEqual([...allIDs].sort((a, b) => a - b), [publishedID, draftID, ...recentIDs].sort((a, b) => a - b))
  assert.equal((await loadAdminGalleryCards(payload, editor))[0].id, publishedID)

  // An edit to an older arrival changes Recently updated but not Featured or Newest addition.
  await payload.update({ collection: 'animals', id: recentIDs[0], overrideAccess: false, user: editor, draft: true,
    data: { internalNotes: 'Recently updated fixture' },
  })
  const recentlyUpdated = await loadAdminGalleryPageCards(payload, editor, { where: scope, sort: '-updatedAt,-id', page: 1, limit: 3 })
  assert.equal(recentlyUpdated[0].id, recentIDs[0])
  const afterEdit = await loadAdminGalleryPageCards(payload, editor, { where: scope, sort: '-updatedAt', page: 1, limit: 3 })
  assert.deepEqual(afterEdit.map(card => card.id), first.map(card => card.id))

  const newest = await loadAdminGalleryPageCards(payload, editor, { where: scope, sort: '-createdAt', page: 1, limit: 8 })
  assert.equal(newest.at(-1)?.id, publishedID)
  assert.equal(newest.at(-1)?.featured, true)
  const female = await loadAdminGalleryPageCards(payload, editor, { where: scope, search: 'female', page: 1, limit: 12 })
  assert.deepEqual(new Set(female.map(card => card.id)), new Set([publishedID, draftID]))
  const black = await loadAdminGalleryPageCards(payload, editor, { where: scope, search: 'black', page: 1, limit: 12 })
  assert.deepEqual(black.map(card => card.id), [publishedID])
  const filtered = await loadAdminGalleryPageCards(payload, editor, { where: { id: { in: recentIDs } }, search: 'Recent gallery fixture', page: 1, limit: 3 })
  assert.equal(filtered.length, 3)
  assert.ok(filtered.every(card => recentIDs.includes(card.id) && !card.featured))
  assert.deepEqual(await loadAdminGalleryPageCards(payload, null, { page: 1, limit: 3 }), [])

  // Attribute searches must not use substrings: male is not female, even in descriptions.
  const harbor = await payload.create({ collection: 'animals', overrideAccess: false, user: editor, draft: true, data: {
    name: 'Harbor Search Fixture', species: 'dog', sex: 'male', ageGroup: 'adult', size: 'small', colors: ['black'], status: 'available',
    summary: 'Lives with female cats.', internalNotes: 'Needs a quiet welcome.', compatibility: { dogs: 'yes', cats: 'unknown', children: 'unknown' }, _status: 'draft',
  } })
  const willow = await payload.create({ collection: 'animals', overrideAccess: false, user: editor, draft: true, data: {
    name: 'Willow Search Fixture', species: 'cat', sex: 'female', ageGroup: 'baby', size: 'small', colors: ['gray'], status: 'available',
    summary: 'Has a male companion.', _status: 'draft',
  } })
  const searchScope = { id: { in: [harbor.id, willow.id] } }
  const searchIDs = async (search: string, extra?: any) => (await loadAdminGalleryPageCards(payload, editor, { where: extra ? { and: [searchScope, extra] } : searchScope, search, page: 1, limit: 12 })).map(card => card.id)
  assert.deepEqual(await searchIDs('male'), [harbor.id])
  assert.deepEqual(await searchIDs('FEMALE'), [willow.id])
  assert.deepEqual(await searchIDs('males'), [harbor.id])
  assert.deepEqual(await searchIDs('small BLACK male dog'), [harbor.id])
  assert.deepEqual(await searchIDs('show me grey female kittens'), [willow.id])
  assert.deepEqual(await searchIDs('black cat'), [])
  assert.deepEqual(await searchIDs('female', { species: { equals: 'dog' } }), [])
  assert.deepEqual(await searchIDs('Harbor quiet'), [harbor.id])
  assert.deepEqual(await searchIDs('quiet Harbor'), [harbor.id])
  assert.deepEqual(await searchIDs('good with dogs'), [harbor.id])
  await payload.update({ collection: 'animals', id: harbor.id, overrideAccess: false, user: editor, draft: true, data: { status: 'on-hold' } })
  assert.deepEqual(await searchIDs('pending male dog'), [harbor.id])
  assert.deepEqual(await searchIDs('available male dog'), [])
  assert.deepEqual(new Set(await searchIDs('male or female')), new Set([harbor.id, willow.id]))
  assert.deepEqual(await searchIDs('\"female cats\"'), [harbor.id])

  // A previously published profile that is now unpublished is a draft, not a live profile with changes.
  await payload.update({ collection: 'animals', id: publishedID, overrideAccess: false, user: editor, data: { _status: 'draft' } })
  assert.equal((await loadAdminGalleryCards(payload, editor, [publishedID]))[0].publication, 'draft')
  const incomplete = await payload.create({ collection: 'animals', overrideAccess: false, user: editor, draft: true, data: { name: 'Incomplete profile', _status: 'draft' } as any })
  const partial = (await loadAdminGalleryCards(payload, editor, [incomplete.id]))[0]
  assert.equal(partial.name, 'Incomplete profile')
  assert.equal(partial.species, null)
  assert.equal(partial.gender, 'Gender not listed')
  assert.equal(partial.age, 'Age unknown')
  assert.equal(partial.photos, 0)
  assert.equal(partial.publication, 'draft')
})

test('CMS document links follow published slugs and never reveal draft or deleted destinations', async () => {
  const target = await payload.create({ collection: 'pages', data: { title: 'Linked page', slug: 'linked-page', body: pageBody('Public content'), _status: 'published' } })
  const internal = (value: unknown, relationTo = 'pages') => ({ type: 'link', fields: { linkType: 'internal', doc: { relationTo, value }, newTab: true }, children: [{ type: 'text', text: 'Read more' }] })
  const source = { root: { children: [internal(target.id), internal({ id: target.id, slug: 'untrusted' }), internal(draftID, 'animals'), internal(admin.id, 'users')] } }
  const original = JSON.stringify(source)
  try {
    await payload.update({ collection: 'pages', id: target.id, draft: true, data: { slug: 'private-linked-draft', _status: 'draft' } })
    const published = await resolveRichTextLinks(payload, source) as any
    assert.equal(published.root.children[0].fields.url, '/linked-page')
    assert.equal(published.root.children[1].fields.url, '/linked-page')
    assert.equal(published.root.children[2].fields.url, '')
    assert.equal(published.root.children[3].fields.url, '')
    assert.equal(JSON.stringify(source), original)
    assert.ok(!JSON.stringify(published).includes('private-linked-draft'))
    await payload.update({ collection: 'pages', id: target.id, data: { slug: 'renamed-linked-page', _status: 'published' } })
    assert.equal(((await resolveRichTextLinks(payload, source)) as any).root.children[0].fields.url, '/renamed-linked-page')
    await payload.delete({ collection: 'pages', id: target.id })
    assert.equal(((await resolveRichTextLinks(payload, source)) as any).root.children[0].fields.url, '')
    assert.deepEqual(await resolveRichTextLinks(payload, { root: { children: [] } }), { root: { children: [] } })
  } finally { await payload.delete({ collection: 'pages', id: target.id }).catch(() => {}) }
})

test('Catministrator saves profile and featured edits as drafts under an editor identity', async () => {
  const createAnimal = (name: string, slug: string) => payload.create({
    collection: 'animals', overrideAccess: false, user: editor,
    data: {
      name, slug, species: 'cat', sex: 'unknown', ageGroup: 'adult', status: 'available',
      summary: 'Original summary', description: 'Original description', photos: [{ photo: publicPhotoID }],
      compatibility: { cats: 'unknown', dogs: 'unknown', children: 'unknown' },
      _status: 'published',
    },
  })
  const first = await createAnimal('First Bot Fixture', 'first-bot-fixture')
  const second = await createAnimal('Second Bot Fixture', 'second-bot-fixture')
  const homepageBefore = await payload.findGlobal({ slug: 'homepage', draft: false, depth: 0 })
  const edit = parseDraftCommand('/edit First Bot Fixture | summary=A proposed summary. | status=pending')!
  const result = await saveCatministratorDraft(payload, editor, edit)
  assert.equal(result.path, '/admin/collections/animals/' + first.id)
  const visible = await payload.findByID({ collection: 'animals', id: first.id, overrideAccess: false, draft: false, depth: 0 })
  const draft = await payload.findByID({ collection: 'animals', id: first.id, user: editor, overrideAccess: false, draft: true, depth: 0 })
  assert.equal(visible.summary, first.summary)
  assert.equal(visible.status, 'available')
  assert.equal(draft.summary, 'A proposed summary.')
  assert.equal(draft.status, 'on-hold')
  assert.equal(draft._status, 'draft')
  assert.equal(draft.description, first.description)
  assert.deepEqual(draft.photos, visible.photos)
  assert.match((await saveCatministratorDraft(payload, editor, edit)).message, /already has those values/)

  const featured = parseDraftCommand('/featured Second Bot Fixture, first-bot-fixture')!
  const original = await saveCatministratorDraft(payload, editor, featured)
  assert.ok(original.review)
  assert.deepEqual(await previewFeaturedAnimals(payload, original.review.previewToken), [second.id, first.id])
  const homepageDraft = await payload.findGlobal({ slug: 'homepage', user: editor, overrideAccess: false, draft: true, depth: 0 })
  assert.equal(homepageDraft._status, 'draft')
  assert.deepEqual(homepageDraft.featuredAnimals?.map(row => row.animal), [second.id, first.id])
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage', draft: false, depth: 0 }), homepageBefore)
  await assert.rejects(() => saveCatministratorDraft(payload, editor, parseDraftCommand('/featured secret-draft')!), /published, available animal/)
  await assert.rejects(() => saveCatministratorDraft(payload, { ...editor, role: undefined }, edit), /cannot edit/)
  const third = await createAnimal('Third Bot Fixture', 'third-bot-fixture')
  await saveCatministratorDraft(payload, editor, parseDraftCommand('/lead Third Bot Fixture')!)
  const current = await publishFeaturedDraft(payload, editor, original.review.publishToken)
  assert.match(current.message, /draft changed/)
  assert.ok(current.review)
  assert.equal(await previewFeaturedAnimals(payload, original.review.previewToken), undefined)
  assert.deepEqual(await previewFeaturedAnimals(payload, current.review.previewToken), [third.id, first.id])
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage', draft: false, depth: 0 }), homepageBefore)
  await assert.rejects(() => publishFeaturedDraft(payload, admin, current.review!.publishToken), /another editor/)
  await assert.rejects(() => publishFeaturedDraft(payload, editor, current.review!.previewToken), /another editor/)
  const promoted = await saveCatministratorDraft(payload, editor, parseDraftCommand('/lead First Bot Fixture')!)
  assert.ok(promoted.review)
  assert.deepEqual(await previewFeaturedAnimals(payload, promoted.review.previewToken), [first.id, third.id])
  const published = await publishFeaturedDraft(payload, editor, promoted.review.publishToken)
  assert.match(published.message, /published/)
  assert.equal(await previewFeaturedAnimals(payload, promoted.review.previewToken), undefined)
  await assert.rejects(() => publishFeaturedDraft(payload, editor, promoted.review!.publishToken), /no longer pending/)
  const live = await payload.findGlobal({ slug: 'homepage', draft: false, depth: 0 })
  assert.deepEqual(live.featuredAnimals?.map(row => row.animal), [first.id, third.id])
  assert.equal(live.heading, homepageBefore.heading)
  await payload.updateGlobal({
    slug: 'homepage', user: editor, overrideAccess: false, draft: true, data: { heading: 'Unrelated draft heading', _status: 'draft' },
  })
  assert.equal((await saveCatministratorDraft(payload, editor, parseDraftCommand('/lead Third Bot Fixture')!)).review, undefined)
})


test('staff can discard the saved featured draft while preserving published content and history', async () => {
  const animal = await payload.create({
    collection: 'animals', user: editor, overrideAccess: false,
    data: {
      name: 'Discard draft fixture', slug: 'discard-draft-fixture', species: 'cat', sex: 'unknown', ageGroup: 'adult', status: 'available',
      summary: 'A fixture animal.', description: 'A fixture animal.', photos: [{ photo: publicPhotoID }],
      compatibility: { cats: 'unknown', dogs: 'unknown', children: 'unknown' }, _status: 'published',
    },
  })
  await payload.updateGlobal({
    slug: 'homepage', user: editor, overrideAccess: false,
    data: { heading: 'Published homepage', intro: pageBody('Published intro.'), featuredAnimals: [], _status: 'published' },
  })
  const live = await payload.findGlobal({ slug: 'homepage', draft: false, depth: 0 })
  const { docs: priorVersions } = await payload.findGlobalVersions({ slug: 'homepage', depth: 0, sort: ['-updatedAt', '-id'] })

  const selection = parseDraftCommand('/featured discard-draft-fixture')!
  await saveCatministratorDraft(payload, editor, selection)
  const first = await payload.findGlobal({ slug: 'homepage', draft: true, depth: 0 })
  await payload.updateGlobal({
    slug: 'homepage', draft: true, user: editor, overrideAccess: false,
    data: { featuredAnimals: [{ animal: animal.id }], _status: 'draft' },
  })
  const pending = await payload.findGlobal({ slug: 'homepage', draft: true, depth: 0 })
  const discardedVersion = await latestFeaturedVersion(payload)
  const { review } = await saveCatministratorDraft(payload, editor, selection)
  assert.ok(review)

  const discard = async (user: typeof editor | null, updatedAt: string) => discardFeaturedDraft(await createLocalReq({
    user,
    req: { headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ updatedAt }) },
  }, payload))

  assert.equal((await discard(null, pending.updatedAt!)).status, 401)
  assert.equal((await discard({ ...editor, role: undefined }, pending.updatedAt!)).status, 403)
  assert.equal((await discard(editor, first.updatedAt!)).status, 409)
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage', draft: true, depth: 0 }), pending)
  const lock = await payload.create({
    collection: 'payload-locked-documents',
    data: { globalSlug: 'homepage', user: { relationTo: 'users', value: admin.id } },
  })
  assert.equal((await discard(editor, pending.updatedAt!)).status, 423)
  await payload.delete({ collection: 'payload-locked-documents', id: lock.id })

  assert.equal((await discard(editor, pending.updatedAt!)).status, 200)
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage', draft: false, depth: 0 }), live)
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage', draft: true, depth: 0 }), live)
  const { docs: remaining } = await payload.findGlobalVersions({ slug: 'homepage', depth: 0, sort: ['-updatedAt', '-id'] })
  assert.deepEqual(remaining.map(({ id, version, updatedAt }) => ({ id, version, updatedAt })),
    priorVersions.map(({ id, version, updatedAt }) => ({ id, version, updatedAt })))
  assert.equal(await previewFeaturedAnimals(payload, review.previewToken), undefined)

  // SQLite's IDs for the removed revisions can be assigned again.
  await saveCatministratorDraft(payload, editor, selection)
  await payload.updateGlobal({
    slug: 'homepage', draft: true, user: editor, overrideAccess: false,
    data: { featuredAnimals: [{ animal: animal.id }], _status: 'draft' },
  })
  assert.equal((await latestFeaturedVersion(payload))?.id, discardedVersion?.id)
  assert.equal(await previewFeaturedAnimals(payload, review.previewToken), undefined)
  const approval = await publishFeaturedDraft(payload, editor, review.publishToken)
  assert.match(approval.message, /draft changed/)
  assert.deepEqual(await payload.findGlobal({ slug: 'homepage', draft: false, depth: 0 }), live)
})


test('featured undo restores only the previous published selection and protects newer work', async () => {
  const animals: { id: number }[] = []
  for (const name of ['Undo First', 'Undo Second', 'Undo Third']) {
    animals.push(await payload.create({
      collection: 'animals', user: editor, overrideAccess: false,
      data: {
        name, slug: name.toLowerCase().replace(' ', '-'), species: 'cat', sex: 'unknown', ageGroup: 'adult', status: 'available',
        summary: 'An undo fixture.', description: 'An undo fixture.', photos: [{ photo: publicPhotoID }],
        compatibility: { cats: 'unknown', dogs: 'unknown', children: 'unknown' }, _status: 'published',
      },
    }))
  }
  const [first, second, third] = animals
  const choices = (list: typeof animals) => list.map(animal => ({ animal: animal.id }))
  const order = async (draft = false) => (await payload.findGlobal({ slug: 'homepage', draft, depth: 0 })).featuredAnimals?.map(row => row.animal)
  const baseline = { heading: 'Undo fixture headline', intro: pageBody('Undo fixture intro.'), featuredAnimals: choices([first, second, third]) }
  await payload.updateGlobal({ slug: 'homepage', user: editor, data: { ...baseline, _status: 'published' } })

  async function publish(order: string, actor = editor) {
    const { review } = await saveCatministratorDraft(payload, actor, parseDraftCommand('/featured ' + order)!)
    assert.ok(review)
    const { undoToken } = await publishFeaturedDraft(payload, actor, review.publishToken)
    assert.ok(undoToken)
    assert.ok(Buffer.byteLength('/undo ' + undoToken) <= 64)
    return undoToken
  }

  const approval = await publish('Undo Third, Undo Second, Undo First')
  assert.deepEqual(await order(), [third.id, second.id, first.id])
  await assert.rejects(() => undoFeaturedPublication(payload, admin, approval), /another editor/)
  const pending = await payload.updateGlobal({
    slug: 'homepage', user: editor, draft: true, data: { featuredAnimals: choices([second, first]), _status: 'draft' },
  })
  await assert.rejects(() => undoFeaturedPublication(payload, editor, approval), /newer featured draft/)
  assert.deepEqual(await order(), [third.id, second.id, first.id])
  assert.deepEqual(await order(true), [second.id, first.id])
  assert.equal((await discardFeaturedDraft(await createLocalReq({
    user: editor,
    req: { headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ updatedAt: pending.updatedAt }) },
  }, payload))).status, 200)

  const restored = await undoFeaturedPublication(payload, editor, approval)
  assert.match(restored.message, /Restored the previous featured order/)
  const live = await payload.findGlobal({ slug: 'homepage', depth: 0 })
  assert.equal(live.heading, baseline.heading)
  assert.equal(richTextToText(live.intro), 'Undo fixture intro.')
  assert.deepEqual(await order(), [first.id, second.id, third.id])
  await assert.rejects(() => undoFeaturedPublication(payload, editor, approval), /can’t be undone/)

  const nextApproval = await publish('Undo Third, Undo Second, Undo First')
  await publish('Undo Second, Undo First, Undo Third', admin)
  await assert.rejects(() => undoFeaturedPublication(payload, editor, nextApproval), /can’t be undone/)
  assert.deepEqual(await order(), [second.id, first.id, third.id])
})


test('Catministrator swaps one featured slot and resolves a unique typo without publishing', async () => {
  const create = (name: string, status: 'available' | 'on-hold' = 'available') => payload.create({
    collection: 'animals', user: editor, overrideAccess: false,
    data: {
      name, slug: name.toLowerCase(), species: 'cat', sex: 'unknown', ageGroup: 'adult', status,
      summary: 'Featured replacement fixture.', description: 'Featured replacement fixture.',
      photos: [{ photo: publicPhotoID }], compatibility: { cats: 'unknown', dogs: 'unknown', children: 'unknown' },
      _status: 'published',
    },
  })
  const bandit = await create('Bandit')
  const fig = await create('Fig')
  const tiny = await create('Tiny')
  const mochachina = await create('Mochachina')
  const options = { slug: 'homepage', user: editor, overrideAccess: false, depth: 0 } as const
  await payload.updateGlobal({ ...options, data: {
    heading: 'Featured replacement', intro: pageBody('Featured replacement fixture.'),
    featuredAnimals: [bandit, fig, tiny].map(animal => ({ animal: animal.id })), _status: 'published',
  } })
  const replace = (text: string) => saveCatministratorDraft(payload, editor, parseDraftCommand('/replace ' + text)!)
  await assert.rejects(() => replace('Mochachina | Tiny'), /isn’t in the featured list/)
  await assert.rejects(() => replace('Tiny | Fig'), /Each featured animal can appear once/)
  const result = await replace('tiny | mocachina')
  assert.match(result.message, /Matched “mocachina” to Mochachina/)
  assert.ok(result.review)
  assert.deepEqual(await previewFeaturedAnimals(payload, result.review.previewToken), [bandit.id, fig.id, mochachina.id])
  const published = await payload.findGlobal({ ...options, draft: false })
  assert.deepEqual(published.featuredAnimals?.map(row => row.animal), [bandit.id, fig.id, tiny.id])

  await create('Mocachinab')
  await assert.rejects(() => replace('Fig | mocachina'), /More than one animal matches/)
  await create('Mocachina', 'on-hold')
  await assert.rejects(() => replace('Fig | mocachina'), /needs to be published and available/)
  assert.deepEqual(await previewFeaturedAnimals(payload, result.review.previewToken), [bandit.id, fig.id, mochachina.id])
})


test('the featured name follow-up suggests CMS matches and protects newer revisions', async () => {
  const create = (name: string, slug: string) => payload.create({
    collection: 'animals', user: editor, overrideAccess: false,
    data: {
      name, slug, species: 'cat', sex: 'unknown', ageGroup: 'adult', status: 'available',
      summary: 'Name follow-up fixture.', description: 'Name follow-up fixture.',
      photos: [{ photo: publicPhotoID }], compatibility: { cats: 'unknown', dogs: 'unknown', children: 'unknown' },
      _status: 'published',
    },
  })
  const first = await create('Piper Follow-up', 'piper-follow-up')
  const second = await create('Misty Follow-up', 'misty-follow-up')
  const maple = await create('Maple', 'maple')
  const options = { slug: 'homepage', user: editor, overrideAccess: false, depth: 0 } as const
  await payload.updateGlobal({ ...options, data: {
    heading: 'Name follow-up', intro: pageBody('Name follow-up fixture.'),
    featuredAnimals: [second, first].map(animal => ({ animal: animal.id })), _status: 'published',
  } })

  const original = parseDraftCommand('/featured Piper Follow-up, Misty Follow-up, map')!
  const unresolved = await saveCatministratorDraft(payload, editor, original).catch((error: unknown) => error)
  assert.ok(unresolved instanceof AnimalNameError)
  assert.equal(unresolved.issue.field, 2)
  assert.deepEqual(unresolved.issue.suggestions, [{ name: 'Maple', slug: 'maple' }])
  assert.equal(typeof unresolved.issue.featuredVersion, 'string')
  assert.equal((await payload.findGlobal({ ...options, draft: true }))._status, 'published')
  const corrected = correctAnimalReference(original, unresolved.issue.field, 'slug:maple')

  // An exact display-name collision must not override a tapped CMS suggestion.
  await create('Maple', 'other-maple')
  const resolved = await saveCatministratorDraft(payload, editor, corrected, unresolved.issue.featuredVersion)
  assert.ok(resolved.review)
  assert.deepEqual(await previewFeaturedAnimals(payload, resolved.review.previewToken), [first.id, second.id, maple.id])

  await assert.rejects(() => saveCatministratorDraft(payload, editor, corrected, unresolved.issue.featuredVersion),
    /The featured list changed/)
  const live = await payload.findGlobal({ ...options, draft: false })
  assert.deepEqual(live.featuredAnimals?.map(row => row.animal), [second.id, first.id])
})


test('Catministrator appends a photo to an animal draft without changing the live gallery', async () => {
  const data = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#978065' } }).jpeg().toBuffer()
  const image = { data, digest: createHash('sha256').update(data).digest('hex') }
  const animal = await payload.findByID({ collection: 'animals', id: publishedID, depth: 0 })
  const plan = { kind: 'update', id: animal.id, name: animal.name } as const
  const photo = (row: NonNullable<typeof animal.photos>[number]) => typeof row.photo === 'number' ? row.photo : row.photo.id
  assert.match((await savePhotoDraft(payload, editor, plan, [image])).message, /Added 1 photo/)
  const live = await payload.findByID({ collection: 'animals', id: animal.id, depth: 0 })
  const draft = await payload.findByID({ collection: 'animals', id: animal.id, depth: 0, draft: true })
  assert.deepEqual(live.photos?.map(photo), animal.photos?.map(photo))
  assert.equal(draft.photos?.length, (animal.photos?.length || 0) + 1)
  const [added] = draft.photos!.slice(-1).map(photo)
  const file = await payload.findByID({ collection: 'media', id: added })
  assert.equal(file.filename, 'catministrator-' + image.digest + '.webp')
  assert.match((await savePhotoDraft(payload, editor, plan, [image])).message, /already on the profile/)
  assert.match((await savePhotoDraft(payload, editor, { kind: 'create', fields: { name: 'Intake Fixture', species: 'cat' } }, [])).message, /Draft saved for Intake Fixture/)
  const { docs: [intake] } = await payload.find({ collection: 'animals', draft: true, where: { name: { equals: 'Intake Fixture' } } })
  assert.equal(intake._status, 'draft')
  assert.equal(intake.species, 'cat')
  assert.equal(intake.ageGroup, null)
  await assert.rejects(() => payload.findByID({ collection: 'animals', id: intake.id, overrideAccess: false }))
})

test('Catministrator replaces exact article wording in a draft only', async () => {
  const page = await payload.create({ collection: 'pages', data: {
    title: 'Catministrator content fixture', slug: 'catministrator-content-fixture', body: pageBody('Visit on Saturday.'), _status: 'published',
  } })
  const request = parseDraftCommand('/page Catministrator content fixture | Visit on Saturday. | Visit on Sunday.')!
  assert.match((await saveCatministratorDraft(payload, editor, request)).message, /Page draft saved/)
  const live = await payload.findByID({ collection: 'pages', id: page.id })
  const draft = await payload.findByID({ collection: 'pages', id: page.id, draft: true })
  assert.equal(richTextToText(live.body), 'Visit on Saturday.')
  assert.equal(richTextToText(draft.body), 'Visit on Sunday.')
})
