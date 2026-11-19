import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, SetStepNav } from '@payloadcms/ui'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { telegramHelp } from '../../lib/admin-sections'
import { isEditor } from '../../lib/catministrator/editors'

const examples = [
  { label: 'Update an animal’s short description', command: '/edit Fig | summary=Sweet and playful.' },
  { label: 'Mark an animal as pending', command: '/edit Tiny | status=pending' },
  { label: 'Set the homepage featured list', command: '/featured Fig, Frida, Rollo' },
]

export function TelegramHelp({ i18n, initPageResult, payload, user, viewActions }: AdminViewServerProps) {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const adminRoute = payload.config.routes.admin
  const helpURL = formatAdminURL({ adminRoute, path: telegramHelp.path })
  if (!req.user) {
    const loginURL = formatAdminURL({ adminRoute, path: payload.config.admin.routes.login })
    redirect(loginURL + '?' + new URLSearchParams({ redirect: helpURL }))
  }
  if (!permissions.canAccessAdmin || !isEditor(req.user)) notFound()

  const localAdministrator = req.user.role === 'admin' && !process.env.TURSO_DATABASE_URL
  const usersURL = formatAdminURL({ adminRoute, path: '/collections/users' })
  const botURL = 'https://t.me/' + telegramHelp.username.slice(1)

  return <DefaultTemplate
    i18n={i18n} locale={locale} payload={payload} permissions={permissions} req={req}
    user={user} viewActions={viewActions} visibleEntities={{ ...visibleEntities }}
  >
    <SetStepNav nav={[{ label: 'Help' }, { label: telegramHelp.label }]} />
    <Gutter>
      <article className="cms-help-article" aria-labelledby="telegram-help-title">
        <header className="cms-help-header">
          <h1 id="telegram-help-title">Using the Telegram bot</h1>
          <p>Send Catministrator a command in Telegram to draft an animal profile edit or update the homepage’s featured animals.</p>
          <a className="cms-button cms-button-primary" href={botURL} target="_blank" rel="noopener noreferrer">
            Open Telegram bot<ArrowUpRight aria-hidden="true" /><span className="cms-sr-only"> (opens in a new tab)</span>
          </a>
        </header>

        <ol className="cms-help-steps" role="list">
          <li>
            <h2>Link your Telegram account</h2>
            <p>Open a private chat with <strong>{telegramHelp.username}</strong> and send <code>/start</code>. Share the numeric ID in the reply with a Pets4Luv administrator, who can link it to your CMS account.</p>
          </li>
          <li>
            <h2>Send a command</h2>
            <p>Once linked, send <code>/help</code> to see the commands. Use the animal’s exact name or its CMS slug.</p>
            <dl className="cms-help-examples">
              {examples.map(({ label, command }) => <div key={command}>
                <dt>{label}</dt>
                <dd><code>{command}</code></dd>
              </div>)}
            </dl>
            <p>For <code>/edit</code>, use <code>summary</code>, <code>description</code>, <code>breed</code>, or <code>status</code> as the field name. Status can be <strong>available</strong>, <strong>pending</strong>, or <strong>adopted</strong>.</p>
            <p><code>/featured</code> replaces the full list. Enter one to three published, available animals in homepage order. The first one gets the large photo.</p>
            <p>If <code>/help</code> says plain-language requests are available, you can also send “Feature Fig first, then Frida and Rollo.”</p>
          </li>
          <li>
            <h2>Review and publish</h2>
            <p>Follow the <strong>Review in the CMS</strong> link in the bot’s reply. Check the saved draft and choose <strong>Publish animal</strong> or <strong>Publish featured animals</strong> when it’s ready.</p>
          </li>
        </ol>

        <section className="cms-help-admin" aria-labelledby="telegram-admin-title">
          <h2 id="telegram-admin-title">For administrators</h2>
          <p>In the local CMS, open {localAdministrator ? <Link href={usersURL}>Settings → Users</Link> : <strong>Settings → Users</strong>}. Select the staff account, enter the number in <strong>Telegram ID</strong>, and save.</p>
          <p>To revoke access, clear <strong>Telegram ID</strong> and save again.</p>
          <p>The plain-language pilot uses GPT-6 Luna at medium effort with Vercel AI Gateway. Confirm Gateway access and set a request limit before enabling it.</p>
        </section>
        <p className="cms-help-note">The Telegram pilot uses the local CMS. Open review links on the computer running it. If the bot is quiet, ask an administrator to check that the local bot process is running.</p>
      </article>
    </Gutter>
  </DefaultTemplate>
}
