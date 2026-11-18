import { access } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { prepareWebsiteSettings } from './website-settings-schema'
import { prepareInformationPages } from './information-pages-schema'
import { cleanupRetiredSchema } from './cleanup-retired-schema'
import { prepareOptionalFields } from './optional-fields-schema'

// First-time installations let Payload create its full schema. Upgrade existing local
// content before Payload synchronizes the current website-only schema.
const url = process.env.DATABASE_URL || 'file:./data/rescue.db'
if (!process.env.TURSO_DATABASE_URL && url.startsWith('file:')) {
  const exists = await access(path.resolve(url.slice(5))).then(() => true, () => false)
  if (exists) {
    const client = createClient({ url })
    try {
      const table = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'website_settings'")
      if (table.rows.length) {
        await prepareWebsiteSettings(client)
        await prepareInformationPages(client)
        await prepareOptionalFields(client)
        await cleanupRetiredSchema(client)
        console.log('Local CMS storage is ready.')
      }
    } finally {
      client.close()
    }
  }
}
