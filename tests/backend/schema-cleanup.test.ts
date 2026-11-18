import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createClient } from '@libsql/client'
import { prepareInformationPages } from '../../scripts/information-pages-schema'
import { cleanupRetiredSchema } from '../../scripts/cleanup-retired-schema'

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pets4luv-clean-schema-'))
  const client = createClient({ url: 'file:' + path.join(directory, 'test.db') })
  await client.batch([
    'CREATE TABLE payload_migrations (id integer PRIMARY KEY, name text, batch integer, updated_at text, created_at text)',
    'CREATE TABLE users (id integer PRIMARY KEY)',
    'CREATE TABLE animals (id integer PRIMARY KEY, name text, age_estimate_reference_date text, energy_level text)',
    'CREATE TABLE media (id integer PRIMARY KEY)',
    'CREATE TABLE pages (id integer PRIMARY KEY, title text, slug text, body text, _status text, updated_at text, created_at text, source text, category text, reviewer text, reviewed_at text)',
    'CREATE TABLE _pages_v (id integer PRIMARY KEY, parent_id integer, version_title text, version_slug text, version_body text, version__status text, version_updated_at text, version_created_at text, created_at text, updated_at text, latest integer, version_source text)',
    'CREATE TABLE knowledge (id integer PRIMARY KEY, title text, slug text, body text, _status text, updated_at text, created_at text)',
    'CREATE TABLE _knowledge_v (id integer PRIMARY KEY, parent_id integer, version_title text, version_slug text, version_body text, version__status text, version_updated_at text, version_created_at text, created_at text, updated_at text, latest integer)',
    'CREATE TABLE intakes (id integer PRIMARY KEY)',
    'CREATE TABLE _intakes_v (id integer PRIMARY KEY)',
    'CREATE TABLE intake_files (id integer PRIMARY KEY)',
    'CREATE TABLE payload_locked_documents (id integer PRIMARY KEY)',
    'CREATE TABLE payload_locked_documents_rels (id integer PRIMARY KEY, "order" integer, parent_id integer, path text, users_id integer, animals_id integer, pages_id integer, media_id integer, knowledge_id integer, intakes_id integer, intake_files_id integer)',
    "INSERT INTO animals VALUES (1, 'Keep this animal', '2026-11-17', 'high')",
    "INSERT INTO pages VALUES (1, 'Edited volunteering', 'volunteering', '{}', 'published', '2026-11-17', '2026-11-16', '', '', '', '')",
    "INSERT INTO knowledge VALUES (1, 'Adoption', 'adoption', '{}', 'published', '2026-11-17', '2026-11-16'), (2, 'Old volunteering', 'volunteering', '{}', 'published', '2026-11-17', '2026-11-16')",
    "INSERT INTO _knowledge_v VALUES (1, 1, 'Adoption', 'adoption', '{}', 'published', '2026-11-17', '2026-11-16', '2026-11-16', '2026-11-17', 0), (2, 1, 'Private pending title', 'adoption', '{}', 'draft', '2026-11-17', '2026-11-16', '2026-11-16', '2026-11-17', 1)",
    'INSERT INTO payload_locked_documents VALUES (1)',
    "INSERT INTO payload_locked_documents_rels VALUES (1, 1, 1, 'document', NULL, 1, NULL, NULL, NULL, NULL, NULL)",
  ], 'write')
  return { client, async close() { client.close(); await rm(directory, { recursive: true, force: true }) } }
}

test('prelaunch cleanup removes retired storage while preserving current content, drafts, locks, and migrated links', async () => {
  const db = await fixture()
  try {
    const { client } = db
    const body = JSON.stringify({ root: { children: [{ type: 'link', fields: { linkType: 'internal', doc: { relationTo: 'knowledge', value: 1 } }, children: [] }] } })
    await client.execute({ sql: 'UPDATE pages SET body = ? WHERE id = 1', args: [body] })
    await client.execute("INSERT INTO _knowledge_v VALUES (3, 2, 'Archived pending volunteering', 'volunteering', '{}', 'draft', '2026-11-17', '2026-11-16', '2026-11-16', '2026-11-17', 1)")
    await prepareInformationPages(client)
    const adoption = (await client.execute("SELECT id FROM pages WHERE slug = 'adoption'")).rows[0].id
    const versions = (await client.execute(`SELECT * FROM _pages_v WHERE parent_id = ${adoption} ORDER BY id`)).rows.map(({ version_source: _source, ...row }) => row)
    await cleanupRetiredSchema(client)
    const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows.map(row => row.name)
    for (const name of ['intakes', 'intake_files', '_intakes_v', 'knowledge', '_knowledge_v']) assert.ok(!tables.includes(name))
    assert.deepEqual((await client.execute('SELECT * FROM animals')).rows, [{ id: 1, name: 'Keep this animal' }])
    assert.deepEqual((await client.execute(`SELECT * FROM _pages_v WHERE parent_id = ${adoption} ORDER BY id`)).rows, versions)
    assert.equal((await client.execute('SELECT * FROM payload_locked_documents_rels')).rows[0].animals_id, 1)
    assert.equal((await client.execute("SELECT title FROM pages WHERE slug = 'volunteering'")).rows[0].title, 'Edited volunteering')
    const history = (await client.execute('SELECT version_title, latest FROM _pages_v WHERE parent_id = 1 ORDER BY id')).rows
    assert.ok(history.some(row => row.version_title === 'Edited volunteering' && row.latest === 1))
    assert.ok(history.some(row => row.version_title === 'Archived pending volunteering' && row.latest === 0))
    const linked = JSON.parse(String((await client.execute('SELECT body FROM pages WHERE id = 1')).rows[0].body))
    assert.deepEqual(linked.root.children[0].fields.doc, { relationTo: 'pages', value: adoption })
    const snapshot = await client.execute('SELECT * FROM payload_migrations ORDER BY id')
    await prepareInformationPages(client)
    await cleanupRetiredSchema(client)
    assert.deepEqual((await client.execute('SELECT * FROM payload_migrations ORDER BY id')).rows, snapshot.rows)
    assert.deepEqual((await client.execute('PRAGMA foreign_key_check')).rows, [])
  } finally { await db.close() }
})

for (const table of ['intakes', 'intake_files']) test(`cleanup refuses to discard unexpected records in ${table}`, async () => {
  const db = await fixture()
  try {
    await prepareInformationPages(db.client)
    await db.client.execute(`INSERT INTO ${table} (id) VALUES (99)`)
    await assert.rejects(cleanupRetiredSchema(db.client), /Export the nonempty retired/)
    assert.equal((await db.client.execute(`SELECT id FROM ${table}`)).rows[0].id, 99)
    assert.equal((await db.client.execute('SELECT count(*) AS n FROM knowledge')).rows[0].n, 2)
    assert.equal((await db.client.execute('SELECT energy_level FROM animals')).rows[0].energy_level, 'high')
  } finally { await db.close() }
})

test('cleanup refuses to remove articles until their content and drafts have been migrated', async () => {
  const db = await fixture()
  try {
    await assert.rejects(cleanupRetiredSchema(db.client), /has not been migrated/)
    assert.equal((await db.client.execute('SELECT count(*) AS n FROM knowledge')).rows[0].n, 2)
    assert.equal((await db.client.execute('SELECT count(*) AS n FROM _knowledge_v')).rows[0].n, 2)
  } finally { await db.close() }
})

test('optional-field upgrade preserves photo and revision relations with foreign keys enabled and is safe to retry', async () => {
  const { prepareOptionalFields } = await import('../../scripts/optional-fields-schema')
  const db = await fixture()
  try {
    const { client } = db
    await client.execute('DROP TABLE media')
    await client.execute("CREATE TABLE media (id integer PRIMARY KEY NOT NULL, alt text NOT NULL)")
    await client.execute("CREATE UNIQUE INDEX media_alt_idx ON media (alt)")
    await client.execute("INSERT INTO media VALUES (3, 'Keep this description')")
    await client.execute('CREATE TABLE animals_photos (id text PRIMARY KEY, photo_id integer REFERENCES media(id) ON DELETE SET NULL)')
    await client.execute("INSERT INTO animals_photos VALUES ('row-1', 3)")
    await client.execute('CREATE TABLE _animals_v (id integer PRIMARY KEY NOT NULL, version_summary text NOT NULL)')
    await client.execute("INSERT INTO _animals_v VALUES (7, 'Keep this revision')")
    await client.execute('CREATE TABLE _animals_v_version_photos (id integer PRIMARY KEY, _parent_id integer REFERENCES _animals_v(id) ON DELETE CASCADE, photo_id integer REFERENCES media(id) ON DELETE SET NULL)')
    await client.execute('INSERT INTO _animals_v_version_photos VALUES (9, 7, 3)')
    await client.execute('PRAGMA foreign_keys=ON')
    await prepareOptionalFields(client)
    assert.deepEqual((await client.execute('SELECT * FROM media')).rows, [{ id: 3, alt: 'Keep this description' }])
    assert.equal((await client.execute('SELECT photo_id FROM animals_photos')).rows[0].photo_id, 3)
    assert.equal((await client.execute('PRAGMA foreign_keys')).rows[0].foreign_keys, 1)
    assert.deepEqual((await client.execute('SELECT * FROM _animals_v_version_photos')).rows, [{ id: 9, _parent_id: 7, photo_id: 3 }])
    assert.equal((await client.execute('SELECT version_summary FROM _animals_v WHERE id = 7')).rows[0].version_summary, 'Keep this revision')
    await client.execute('INSERT INTO media (id, alt) VALUES (4, NULL)')
    await client.execute('INSERT INTO media (id) VALUES (5)')
    assert.equal((await client.execute('SELECT alt FROM media WHERE id = 5')).rows[0].alt, '')
    const snapshot = (await client.execute('SELECT * FROM media ORDER BY id')).rows
    await prepareOptionalFields(client)
    assert.deepEqual((await client.execute('SELECT * FROM media ORDER BY id')).rows, snapshot)
    assert.ok((await client.execute('PRAGMA index_list(media)')).rows.some(row => row.name === 'media_alt_idx'))
    assert.deepEqual((await client.execute('PRAGMA foreign_key_check')).rows, [])
  } finally { await db.close() }
})
