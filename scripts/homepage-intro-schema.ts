import type { Client, InStatement } from '@libsql/client'
import { defaultHomepageIntro } from '../src/lib/homepage-intro'

function sqlString(value: string): string {
  return "'" + value.replaceAll("'", "''") + "'"
}

/** Only the additive Homepage Intro tables; matches Payload's generated SQLite schema. */
export function homepageIntroSchemaStatements(): InStatement[] {
  const heading = sqlString(defaultHomepageIntro.heading)
  const body = sqlString(JSON.stringify(defaultHomepageIntro.body))
  return [
    `CREATE TABLE IF NOT EXISTS homepage_intro (
      id integer PRIMARY KEY NOT NULL,
      heading text DEFAULT ${heading},
      body text DEFAULT ${body},
      _status text DEFAULT 'draft',
      updated_at text,
      created_at text
    )`,
    'CREATE INDEX IF NOT EXISTS homepage_intro__status_idx ON homepage_intro (_status)',
    `CREATE TABLE IF NOT EXISTS _homepage_intro_v (
      id integer PRIMARY KEY NOT NULL,
      version_heading text DEFAULT ${heading},
      version_body text DEFAULT ${body},
      version__status text DEFAULT 'draft',
      version_updated_at text,
      version_created_at text,
      created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      latest integer
    )`,
    'CREATE INDEX IF NOT EXISTS _homepage_intro_v_version_version__status_idx ON _homepage_intro_v (version__status)',
    'CREATE INDEX IF NOT EXISTS _homepage_intro_v_created_at_idx ON _homepage_intro_v (created_at)',
    'CREATE INDEX IF NOT EXISTS _homepage_intro_v_updated_at_idx ON _homepage_intro_v (updated_at)',
    'CREATE INDEX IF NOT EXISTS _homepage_intro_v_latest_idx ON _homepage_intro_v (latest)',
    {
      sql: `INSERT INTO homepage_intro (heading, body, _status, updated_at, created_at)
        SELECT ?, ?, 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE NOT EXISTS (SELECT 1 FROM homepage_intro)`,
      args: [defaultHomepageIntro.heading, JSON.stringify(defaultHomepageIntro.body)],
    },
    `INSERT INTO _homepage_intro_v (version_heading, version_body, version__status, version_updated_at, version_created_at, latest)
      SELECT heading, body, _status, updated_at, created_at, 1 FROM homepage_intro
      WHERE NOT EXISTS (SELECT 1 FROM _homepage_intro_v)
      ORDER BY id LIMIT 1`,
  ]
}

/** One transaction prevents a partial schema or seed; reruns preserve all existing records. */
export async function prepareHomepageIntro(client: Pick<Client, 'batch'>): Promise<void> {
  await client.batch(homepageIntroSchemaStatements(), 'write')
}
