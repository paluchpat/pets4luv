import type { Client } from '@libsql/client'

const migration = '20261117_remove_retired_website_schema'

/** Remove abandoned prototype storage only after information pages have been migrated. */
export async function cleanupRetiredSchema(client: Client): Promise<void> {
  const tables = new Set((await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows.map(row => String(row.name)))
  if (!tables.has('payload_migrations')) return
  if ((await client.execute({ sql: 'SELECT id FROM payload_migrations WHERE name = ?', args: [migration] })).rows.length) return

  const transaction = await client.transaction('write')
  try {
    // Never silently discard an unexpected operational record or an unmigrated article.
    for (const table of ['intakes', 'intake_files']) {
      if (tables.has(table) && (await transaction.execute(`SELECT id FROM ${table} LIMIT 1`)).rows.length) {
        throw new Error(`Export the nonempty retired ${table} storage before removing it.`)
      }
    }
    if (tables.has('knowledge')) {
      const articles = await transaction.execute('SELECT id, slug FROM knowledge')
      const destinations = new Map<number, number>()
      for (const row of articles.rows) {
        const moved = await transaction.execute({ sql: 'SELECT id FROM payload_migrations WHERE name = ?', args: [`20261117_information_page_${row.slug}`] })
        if (!moved.rows.length) throw new Error(`The retired article ${row.slug} has not been migrated into Pages.`)
        const target = await transaction.execute({
          sql: `SELECT id FROM pages WHERE slug = ? UNION ALL
            SELECT p.id FROM pages p JOIN _pages_v v ON v.parent_id = p.id WHERE v.version_slug = ? LIMIT 1`,
          args: [row.slug, row.slug],
        })
        if (target.rows.length) {
          const pageID = Number(target.rows[0].id)
          destinations.set(Number(row.id), pageID)
          // Keep the current page authoritative while retaining any unique archived revisions.
          await transaction.execute({
            sql: `INSERT INTO _pages_v (parent_id, version_title, version_slug, version_body, version__status,
              version_updated_at, version_created_at, created_at, updated_at, latest)
              SELECT p.id, p.title, p.slug, p.body, p._status, p.updated_at, p.created_at,
                p.created_at, p.updated_at, 1 FROM pages p WHERE p.id = ?
                AND NOT EXISTS (SELECT 1 FROM _pages_v WHERE parent_id = p.id)`,
            args: [pageID],
          })
          await transaction.execute({
            sql: `INSERT INTO _pages_v (parent_id, version_title, version_slug, version_body, version__status,
              version_updated_at, version_created_at, created_at, updated_at, latest)
              SELECT ?, k.version_title, k.version_slug, k.version_body, k.version__status,
                k.version_updated_at, k.version_created_at, k.created_at, k.updated_at, 0
              FROM _knowledge_v k WHERE k.parent_id = ? AND NOT EXISTS (
                SELECT 1 FROM _pages_v p WHERE p.parent_id = ?
                  AND p.version_title IS k.version_title AND p.version_slug IS k.version_slug
                  AND p.version_body IS k.version_body AND p.version__status IS k.version__status
                  AND p.created_at IS k.created_at AND p.updated_at IS k.updated_at
              )`,
            args: [pageID, row.id, pageID],
          })
        }
      }
      // Preserve document links to the moved articles, including links in saved drafts.
      function moveLinks(value: any): any {
        if (!value || typeof value !== 'object') return value
        if (Array.isArray(value)) return value.map(moveLinks)
        if (value.relationTo === 'knowledge') {
          const id = typeof value.value === 'object' ? value.value?.id : value.value
          return { relationTo: 'pages', value: destinations.get(Number(id)) ?? null }
        }
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, moveLinks(child)]))
      }
      for (const [table, column] of [['pages', 'body'], ['_pages_v', 'version_body'], ['homepage_intro', 'body'], ['_homepage_intro_v', 'version_body'], ['homepage', 'intro'], ['_homepage_v', 'version_intro']]) {
        if (!tables.has(table)) continue
        for (const row of (await transaction.execute(`SELECT id, ${column} AS content FROM ${table} WHERE ${column} LIKE '%knowledge%'`)).rows) {
          const content = JSON.stringify(moveLinks(JSON.parse(String(row.content))))
          await transaction.execute({ sql: `UPDATE ${table} SET ${column} = ? WHERE id = ?`, args: [content, row.id] })
        }
      }
    }

    if (tables.has('payload_locked_documents_rels')) {
      const columns = new Set((await transaction.execute('PRAGMA table_info(payload_locked_documents_rels)')).rows.map(row => row.name))
      const retired = ['knowledge_id', 'intakes_id', 'intake_files_id'].filter(column => columns.has(column))
      if (retired.length) {
        // The current Payload lock relation schema, preserving IDs and all active editor locks.
        await transaction.execute(`CREATE TABLE payload_locked_documents_rels_current (
          id integer PRIMARY KEY NOT NULL, "order" integer, parent_id integer NOT NULL, path text NOT NULL,
          users_id integer, animals_id integer, pages_id integer, media_id integer,
          FOREIGN KEY (parent_id) REFERENCES payload_locked_documents(id) ON DELETE cascade,
          FOREIGN KEY (users_id) REFERENCES users(id) ON DELETE cascade,
          FOREIGN KEY (animals_id) REFERENCES animals(id) ON DELETE cascade,
          FOREIGN KEY (pages_id) REFERENCES pages(id) ON DELETE cascade,
          FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE cascade
        )`)
        await transaction.execute(`INSERT INTO payload_locked_documents_rels_current
          SELECT id, "order", parent_id, path, users_id, animals_id, pages_id, media_id
          FROM payload_locked_documents_rels WHERE ${retired.map(column => `${column} IS NULL`).join(' AND ')}`)
        await transaction.execute('DROP TABLE payload_locked_documents_rels')
        await transaction.execute('ALTER TABLE payload_locked_documents_rels_current RENAME TO payload_locked_documents_rels')
        for (const [suffix, column] of [['order', '"order"'], ['parent', 'parent_id'], ['path', 'path'], ['users_id', 'users_id'], ['animals_id', 'animals_id'], ['pages_id', 'pages_id'], ['media_id', 'media_id']]) {
          await transaction.execute(`CREATE INDEX payload_locked_documents_rels_${suffix}_idx ON payload_locked_documents_rels (${column})`)
        }
      }
    }
    for (const table of ['_intakes_v', 'intakes', 'intake_files', '_knowledge_v', 'knowledge']) {
      if (tables.has(table)) await transaction.execute(`DROP TABLE ${table}`)
    }
    for (const [table, retired] of [
      ['animals', ['age_estimate_reference_date', 'energy_level']],
      ['_animals_v', ['version_age_estimate_reference_date', 'version_energy_level']],
      ['pages', ['category', 'source', 'reviewer', 'reviewed_at']],
      ['_pages_v', ['version_category', 'version_source', 'version_reviewer', 'version_reviewed_at']],
      ['website_settings', ['paypal_url', 'venmo_url']],
      ['_website_settings_v', ['version_paypal_url', 'version_venmo_url']],
    ] as const) {
      if (!tables.has(table)) continue
      const columns = new Set((await transaction.execute(`PRAGMA table_info(${table})`)).rows.map(row => row.name))
      for (const column of retired) if (columns.has(column)) await transaction.execute(`ALTER TABLE ${table} DROP COLUMN ${column}`)
    }
    await transaction.execute({
      sql: `INSERT INTO payload_migrations (name, batch, updated_at, created_at)
        VALUES (?, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      args: [migration],
    })
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  } finally {
    transaction.close()
  }
}
