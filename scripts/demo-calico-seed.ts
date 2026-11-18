import type { Payload } from 'payload'
import type { SQLiteAdapter } from '@payloadcms/db-sqlite'

const migration = '20261117_olive_demo_calico'
const demoNote = 'Fictional demonstration record. Never use this fixture as an actual adoption listing.'

/** Tag the reviewed sample photo once, preserving real profiles and subsequent editorial changes. */
export async function seedDemoCalico(payload: Payload): Promise<number> {
  const client = (payload.db as unknown as SQLiteAdapter).client
  const done = await client.execute({ sql: 'SELECT id FROM payload_migrations WHERE name = ? LIMIT 1', args: [migration] })
  if (done.rows.length) return 0
  const { docs: [olive] } = await payload.find({ collection: 'animals', draft: true, depth: 1, limit: 1, where: { slug: { equals: 'olive' } } })
  const photo = olive?.photos?.[0]?.photo
  if (!olive || olive.species !== 'cat' || olive.status !== 'available' || olive._status !== 'published'
    || olive.internalNotes !== demoNote || typeof photo !== 'object' || photo?.alt !== 'Olive, fictional demo animal') return 0
  const colors = olive.colors || []
  const changed = !colors.includes('calico')
  if (changed) await payload.update({ collection: 'animals', id: olive.id, data: { colors: [...colors, 'calico'], _status: 'published' } })
  await client.execute({
    sql: `INSERT INTO payload_migrations (name, batch, updated_at, created_at)
      VALUES (?, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    args: [migration],
  })
  return changed ? 1 : 0
}
