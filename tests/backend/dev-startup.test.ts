import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { createClient } from '@libsql/client'
import { prepareWebsiteSettings } from '../../scripts/website-settings-schema'

const run = promisify(execFile)
async function startPreparation(database: string, remote = false) {
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: 'file:' + database }
  delete env.TURSO_DATABASE_URL
  delete env.TURSO_AUTH_TOKEN
  if (remote) env.TURSO_DATABASE_URL = 'libsql://unused.example.invalid'
  await run(process.execPath, ['--import', 'tsx', path.resolve('scripts/prepare-dev.ts')], { env, timeout: 10000 })
}

test('development startup leaves a first-time installation to Payload', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pets4luv-first-dev-'))
  try {
    const database = path.join(directory, 'new.db')
    await startPreparation(database)
    await assert.rejects(access(database))
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('development startup upgrades old settings and revisions before the CMS reads them', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pets4luv-dev-upgrade-'))
  const database = path.join(directory, 'existing.db')
  const client = createClient({ url: 'file:' + database })
  try {
    await prepareWebsiteSettings(client)
    await client.batch([
      'ALTER TABLE website_settings ADD COLUMN paypal_url text',
      'ALTER TABLE _website_settings_v ADD COLUMN version_paypal_url text',
      "UPDATE website_settings SET paypal_url = 'https://paypal.me/CurrentRescue', phone = '212-555-0100'",
      "UPDATE _website_settings_v SET version_paypal_url = 'https://paypal.me/SavedRescue'",
      'ALTER TABLE website_settings DROP COLUMN paypal_handle',
      'ALTER TABLE _website_settings_v DROP COLUMN version_paypal_handle',
    ], 'write')
    const before = (await client.execute('SELECT phone, paypal_url FROM website_settings')).rows
    await startPreparation(database)
    assert.equal((await client.execute('SELECT paypal_handle FROM website_settings')).rows[0].paypal_handle, 'CurrentRescue')
    assert.equal((await client.execute('SELECT version_paypal_handle FROM _website_settings_v')).rows[0].version_paypal_handle, 'SavedRescue')
    assert.deepEqual((await client.execute('SELECT phone, paypal_url FROM website_settings')).rows, before)
    await client.execute("UPDATE website_settings SET paypal_handle = ''")
    await startPreparation(database)
    assert.equal((await client.execute('SELECT paypal_handle FROM website_settings')).rows[0].paypal_handle, '')
  } finally { client.close(); await rm(directory, { recursive: true, force: true }) }
})

test('development startup does not modify databases when remote storage is configured', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pets4luv-remote-dev-'))
  try {
    const database = path.join(directory, 'unused.db')
    await startPreparation(database, true)
    await assert.rejects(access(database))
  } finally { await rm(directory, { recursive: true, force: true }) }
})
