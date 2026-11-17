import { access } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { prepareWebsiteSettings } from './website-settings-schema'

// First-time installations let Payload create its full schema. Existing local databases
// need additive Website Settings upgrades before the new fields are queried by the CMS.
const url = process.env.DATABASE_URL || 'file:./data/rescue.db'
if (!process.env.TURSO_DATABASE_URL && url.startsWith('file:')) {
  const exists = await access(path.resolve(url.slice(5))).then(() => true, () => false)
  if (exists) {
    const client = createClient({ url })
    try {
      const table = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'website_settings'")
      if (table.rows.length) {
        await prepareWebsiteSettings(client)
        console.log('Local Website Settings storage is ready.')
      }
    } finally {
      client.close()
    }
  }
}
