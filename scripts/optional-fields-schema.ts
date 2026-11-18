import type { Client, InStatement } from '@libsql/client'
import { defaultWebsiteSettings } from '../src/lib/website-settings'

const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"'
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"

/** Complete earlier optional-field changes without losing rows, photo relations, or indexes. */
export async function prepareOptionalFields(client: Client): Promise<void> {
  const updates = [
    ['animals', 'summary', ''], ['_animals_v', 'version_summary', ''], ['media', 'alt', ''],
    ['website_settings', 'paypal_handle', defaultWebsiteSettings.paypalHandle],
    ['_website_settings_v', 'version_paypal_handle', defaultWebsiteSettings.paypalHandle],
  ] as const
  const statements: InStatement[] = []
  for (const [table, field, value] of updates) {
    const { rows: columns } = await client.execute(`PRAGMA table_info(${quote(table)})`)
    const target = columns.find(row => row.name === field)
    if (!target || target.notnull === 0 && target.dflt_value === literal(value)) continue
    const definitions = columns.map(column => {
      const optional = column.name === field
      return `${quote(String(column.name))} ${column.type}${column.pk ? ' PRIMARY KEY' : ''}${!optional && column.notnull ? ' NOT NULL' : ''}` +
        (optional ? ` DEFAULT ${literal(value)}` : column.dflt_value == null ? '' : ` DEFAULT (${column.dflt_value})`)
    })
    const foreignKeys = (await client.execute(`PRAGMA foreign_key_list(${quote(table)})`)).rows
    for (const id of new Set(foreignKeys.map(row => row.id))) {
      const key = foreignKeys.filter(row => row.id === id).sort((a, b) => Number(a.seq) - Number(b.seq))
      definitions.push(`FOREIGN KEY (${key.map(row => quote(String(row.from))).join(', ')}) REFERENCES ${quote(String(key[0].table))} (${key.map(row => quote(String(row.to))).join(', ')}) ON UPDATE ${key[0].on_update} ON DELETE ${key[0].on_delete}`)
    }
    const auxiliary = await client.execute({ sql: "SELECT sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index', 'trigger') AND sql IS NOT NULL", args: [table] })
    const temporary = quote(`__current_${table}`)
    const names = columns.map(row => quote(String(row.name))).join(', ')
    statements.push(
      `CREATE TABLE ${temporary} (${definitions.join(', ')})`,
      `INSERT INTO ${temporary} (${names}) SELECT ${names} FROM ${quote(table)}`,
      `DROP TABLE ${quote(table)}`,
      `ALTER TABLE ${temporary} RENAME TO ${quote(table)}`,
      ...auxiliary.rows.map(row => String(row.sql)),
    )
  }
  // libSQL's migration API disables FK actions for the transaction and restores them afterward,
  // including over Turso's HTTP transport. Child photo rows therefore keep their original IDs.
  if (statements.length) await client.migrate(statements)
}
