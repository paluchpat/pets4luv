import type { SQLiteAdapter } from '@payloadcms/db-sqlite'

// Suppress development schema push and HMR before loading Payload or the config.
process.env.PAYLOAD_MIGRATING = 'true'
process.env.DISABLE_PAYLOAD_HMR = 'true'

const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const { prepareHomepageIntro } = await import('./homepage-intro-schema')
const { prepareWebsiteSettings } = await import('./website-settings-schema')
const { prepareInformationPages } = await import('./information-pages-schema')
const { seedPoppyPhotos } = await import('./poppy-photos-seed')
const { seedDemoCalico } = await import('./demo-calico-seed')
const { prepareMainMenuSchema } = await import('./main-menu-schema')
const { seedMainMenu } = await import('./main-menu-seed')
const resolvedConfig = await config

// The build generates types next; avoid Payload's unawaited development child process.
const payload = await getPayload({
  config: { ...resolvedConfig, logger: 'sync', typescript: { ...resolvedConfig.typescript, autoGenerate: false } },
  disableOnInit: true,
})
const client = (payload.db as unknown as SQLiteAdapter).client
try {
  await prepareWebsiteSettings(client)
  await prepareHomepageIntro(client)
  await prepareInformationPages(client)
  await prepareMainMenuSchema(client)
  await seedMainMenu(payload)
  const addedPhotos = await seedPoppyPhotos(payload)
  if (addedPhotos) console.log(`Added ${addedPhotos} extra Poppy demo photos.`)
  if (await seedDemoCalico(payload)) console.log('Added the Calico tag to Olive’s sample profile.')
} finally {
  try {
    await payload.destroy()
  } finally {
    // Payload's SQLite adapter destroy clears its schema but does not close this client.
    client.close()
  }
}
console.log('Homepage, Pages, Website Settings, and Main Menu storage is ready. Existing content and drafts were preserved.')
// CLI preparation is complete; errors above remain uncaught and exit nonzero.
process.exit(0)
