import type { Client } from '@libsql/client'

const articleSlugs = ['adoption', 'volunteering'] as const

/** Move existing articles and their revisions into Pages once, inside one write transaction. */
export async function prepareInformationPages(client: Client): Promise<void> {
  const transaction = await client.transaction('write')
  try {
    const pageColumns = await transaction.execute('PRAGMA table_info(pages)')
    const knowledgeColumns = await transaction.execute('PRAGMA table_info(knowledge)')
    // A fresh installation creates the rest of its schema during setup and seeding.
    if (!pageColumns.rows.length || !knowledgeColumns.rows.length) {
      await transaction.commit()
      return
    }

    for (const slug of articleSlugs) {
      const name = `20261117_information_page_${slug}`
      const recorded = await transaction.execute({ sql: 'SELECT id FROM payload_migrations WHERE name = ? LIMIT 1', args: [name] })
      if (recorded.rows.length) continue
      const source = await transaction.execute({ sql: 'SELECT id FROM knowledge WHERE slug = ? LIMIT 1', args: [slug] })
      if (!source.rows.length) continue

      const existing = await transaction.execute({ sql: 'SELECT id FROM pages WHERE slug = ? LIMIT 1', args: [slug] })
      if (!existing.rows.length) {
        const inserted = await transaction.execute({
          sql: `INSERT INTO pages (title, slug, body, _status, updated_at, created_at)
            SELECT title, slug, body, _status, updated_at, created_at
            FROM knowledge WHERE id = ? RETURNING id`,
          args: [source.rows[0].id],
        })
        const pageID = inserted.rows[0].id
        await transaction.execute({
          sql: `INSERT INTO _pages_v (
            parent_id, version_title, version_slug, version_body, version__status,
            version_updated_at, version_created_at, created_at, updated_at, latest
          ) SELECT ?, version_title, version_slug, version_body, version__status,
            version_updated_at, version_created_at, created_at, updated_at, latest
            FROM _knowledge_v WHERE parent_id = ? ORDER BY id`,
          args: [pageID, source.rows[0].id],
        })
        await transaction.execute({
          sql: `INSERT INTO _pages_v (
            parent_id, version_title, version_slug, version_body, version__status,
            version_updated_at, version_created_at, created_at, updated_at, latest
          ) SELECT id, title, slug, body, _status, updated_at, created_at,
            coalesce(created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            coalesce(updated_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), 1
            FROM pages WHERE id = ?
            AND NOT EXISTS (SELECT 1 FROM _pages_v WHERE parent_id = ?)`,
          args: [pageID, pageID],
        })
      }
      // Record completion even if an editor already created this page. Later builds preserve it.
      await transaction.execute({
        sql: `INSERT INTO payload_migrations (name, batch, updated_at, created_at)
          VALUES (?, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        args: [name],
      })
    }
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  } finally {
    transaction.close()
  }
}
