import type { Client, InStatement } from '@libsql/client'
import { defaultWebsiteSettings, paypalHandleFromUrl, websiteSettingKeys } from '../src/lib/website-settings'

function sqlString(value: string) { return "'" + value.replaceAll("'", "''") + "'" }
function columnName(value: string) { return value.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase()) }

/** Add only this global and its revision storage; reruns preserve all editor changes. */
export async function prepareWebsiteSettings(client: Pick<Client, 'transaction'>): Promise<void> {
  const columns = websiteSettingKeys.map(key => ({ name: columnName(key), value: defaultWebsiteSettings[key] }))
  const definitions = (prefix: string) => [...columns.map(({ name, value }) => prefix + name + ' text DEFAULT ' + sqlString(value)), prefix + 'paypal_url text', prefix + 'venmo_url text'].join(', ')
  const names = columns.map(column => column.name).join(', ')
  const statements: InStatement[] = [
    'CREATE TABLE IF NOT EXISTS website_settings (id integer PRIMARY KEY NOT NULL, ' + definitions('') + ", _status text DEFAULT 'draft', updated_at text, created_at text)",
    'CREATE INDEX IF NOT EXISTS website_settings__status_idx ON website_settings (_status)',
    'CREATE TABLE IF NOT EXISTS _website_settings_v (id integer PRIMARY KEY NOT NULL, ' + definitions('version_') + ", version__status text DEFAULT 'draft', version_updated_at text, version_created_at text, created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL, updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL, latest integer)",
    'CREATE INDEX IF NOT EXISTS _website_settings_v_version_version__status_idx ON _website_settings_v (version__status)',
    'CREATE INDEX IF NOT EXISTS _website_settings_v_created_at_idx ON _website_settings_v (created_at)',
    'CREATE INDEX IF NOT EXISTS _website_settings_v_updated_at_idx ON _website_settings_v (updated_at)',
    'CREATE INDEX IF NOT EXISTS _website_settings_v_latest_idx ON _website_settings_v (latest)',
    {
      sql: 'INSERT INTO website_settings (' + names + ", _status, updated_at, created_at) SELECT " + columns.map(() => '?').join(', ') + ", 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (SELECT 1 FROM website_settings)",
      args: columns.map(column => column.value),
    },
    'INSERT INTO _website_settings_v (' + columns.map(column => 'version_' + column.name).join(', ') + ', version__status, version_updated_at, version_created_at, latest) SELECT ' + names + ', _status, updated_at, created_at, 1 FROM website_settings WHERE NOT EXISTS (SELECT 1 FROM _website_settings_v) ORDER BY id LIMIT 1',
  ]
  const transaction = await client.transaction('write')
  try {
    await transaction.batch(statements.slice(0, -2))
    for (const [table, prefix] of [['website_settings', ''], ['_website_settings_v', 'version_']] as const) {
      const existing = await transaction.execute('PRAGMA table_info(' + table + ')')
      const names = new Set(existing.rows.map(row => String(row.name)))
      const handleColumn = prefix + 'paypal_handle'
      if (names.has(handleColumn)) continue
      await transaction.execute('ALTER TABLE ' + table + ' ADD COLUMN ' + handleColumn + ' text')
      const urlColumn = prefix + 'paypal_url'
      if (names.has(urlColumn)) {
        const legacy = await transaction.execute('SELECT id, ' + urlColumn + ' AS url FROM ' + table)
        if (legacy.rows.length) await transaction.batch(legacy.rows.map(row => ({
          sql: 'UPDATE ' + table + ' SET ' + handleColumn + ' = ? WHERE id = ?',
          args: [paypalHandleFromUrl(row.url), row.id],
        })))
      } else {
        await transaction.execute({ sql: 'UPDATE ' + table + ' SET ' + handleColumn + ' = ?', args: [defaultWebsiteSettings.paypalHandle] })
      }
    }
    await transaction.batch(statements.slice(-2))
    await transaction.commit()
  } finally {
    // Rolls back an incomplete upgrade; existing handles, published content, and drafts stay intact.
    transaction.close()
  }
}
