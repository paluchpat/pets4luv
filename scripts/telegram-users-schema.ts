import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { Client } from '@libsql/client'
import { isTelegramUserID } from '../src/lib/catministrator/editors'

export const legacyTelegramEditors = 'data/catministrator/editors'

async function readLegacyLinks(directory: string) {
  const files = await readdir(directory).catch(error => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const links: { id: string; editor: number; linkedAt: number }[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const id = file.slice(0, -5)
    if (!isTelegramUserID(id)) continue
    const link = JSON.parse(await readFile(path.join(directory, file), 'utf8'))
    if (Number.isSafeInteger(link?.editor) && Number.isSafeInteger(link?.linkedAt) &&
        Number.isFinite(new Date(link.linkedAt * 1000).getTime())) {
      links.push({ id, editor: link.editor, linkedAt: link.linkedAt })
    }
  }
  return links.sort((a, b) => a.linkedAt - b.linkedAt || a.id.localeCompare(b.id))
}

export async function prepareTelegramUsers(client: Pick<Client, 'transaction'>, legacyDirectory?: string) {
  const transaction = await client.transaction('write')
  try {
    const { rows } = await transaction.execute('PRAGMA table_info(users)')
    if (!rows.length) return

    const addID = !rows.some(row => row.name === 'telegram_user_id')
    if (addID) await transaction.execute('ALTER TABLE users ADD COLUMN telegram_user_id text')
    if (!rows.some(row => row.name === 'telegram_linked_at')) {
      await transaction.execute('ALTER TABLE users ADD COLUMN telegram_linked_at text')
    }
    await transaction.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_user_id_idx ON users (telegram_user_id)')

    // Import once with the schema so a cleared CMS field cannot restore a file-based link.
    if (addID && legacyDirectory) {
      const links = await readLegacyLinks(legacyDirectory)
      if (links.length) await transaction.batch(links.map(({ id, editor, linkedAt }) => ({
        sql: "UPDATE users SET telegram_user_id = ?, telegram_linked_at = ? WHERE id = ? AND role IN ('admin', 'editor')",
        args: [id, new Date(linkedAt * 1000).toISOString(), editor],
      })))
    }
    await transaction.commit()
  } finally {
    transaction.close()
  }
}
