import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { seedPages } from './page-seeds'

process.env.DISABLE_PAYLOAD_HMR = 'true'
const resolvedConfig = await config
const payload = await getPayload({ config: { ...resolvedConfig, typescript: { ...resolvedConfig.typescript, autoGenerate: false } } })
try {
  const { created } = await seedPages(payload)
  if (created.length) console.log(`Created missing pages: ${created.join(', ')}.`)
  if (!created.length) console.log('All starter pages already exist. No page content was changed.')
} finally {
  const client = (payload.db as unknown as SQLiteAdapter).client
  try { await payload.destroy() } finally { client.close() }
}
