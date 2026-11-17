import path from 'node:path'
import type { Payload } from 'payload'
import type { SQLiteAdapter } from '@payloadcms/db-sqlite'

const fixtureNote = 'Fictional demonstration record. Never use this fixture as an actual adoption listing.'
const batches = [
  { migration: '20261117_poppy_additional_demo_photos', additions: [
    { file: 'poppy-playing.webp', alt: 'Poppy, fictional gray kitten playing with a felt ball' },
    { file: 'poppy-resting.webp', alt: 'Poppy, fictional gray kitten resting on a cushion by a window' },
  ] },
  { migration: '20261117_poppy_three_more_demo_photos', additions: [
    { file: 'poppy-stretching.webp', alt: 'Poppy, fictional gray kitten stretching on an oatmeal blanket' },
    { file: 'poppy-window.webp', alt: 'Poppy, fictional gray kitten enjoying the daylight on a window seat' },
    { file: 'poppy-basket.webp', alt: 'Poppy, fictional gray kitten peeking out of a blanket-lined basket' },
  ] },
] as const

/** Append demo photos once, preserving the main photo and any editorial changes. */
export async function seedPoppyPhotos(payload: Payload): Promise<number> {
  const client = (payload.db as unknown as SQLiteAdapter).client
  const pending = []
  for (const batch of batches) {
    const done = await client.execute({ sql: 'SELECT id FROM payload_migrations WHERE name = ? LIMIT 1', args: [batch.migration] })
    if (!done.rows.length) pending.push(batch)
  }
  if (!pending.length) return 0

  const { docs: [poppy] } = await payload.find({ collection: 'animals', draft: true, depth: 0, limit: 1, where: { slug: { equals: 'poppy' } } })
  // Never apply fictional images to a real listing or publish an editor's pending draft.
  if (!poppy || poppy.internalNotes !== fixtureNote || poppy._status !== 'published') return 0

  const photos = [...(poppy.photos || [])]
  let added = 0
  for (const { file, alt } of pending.flatMap(batch => [...batch.additions])) {
    const found = await payload.find({ collection: 'media', depth: 0, limit: 1, where: { alt: { equals: alt } } })
    const photo = found.docs[0] || await payload.create({ collection: 'media', data: { alt }, filePath: path.resolve('public/images', file) })
    if (!photos.some(row => (typeof row.photo === 'object' ? row.photo.id : row.photo) === photo.id)) {
      photos.push({ photo: photo.id })
      added++
    }
  }
  if (added) await payload.update({ collection: 'animals', id: poppy.id, data: { photos, _status: 'published' } })
  for (const { migration } of pending) await client.execute({
    sql: `INSERT INTO payload_migrations (name, batch, updated_at, created_at)
      VALUES (?, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    args: [migration],
  })
  return added
}
