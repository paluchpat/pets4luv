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
  { label: 'Change the lead photo', command: '/lead Tiny' },
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

  const administrator = req.user.role === 'admin'
  const hosted = Boolean(process.env.TURSO_DATABASE_URL)
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
            <p><code>/lead</code> changes the first slot. If the animal is already featured, it moves to the front.</p>
            <p>If <code>/help</code> says plain-language requests are available, you can also send “Set the first featured animal to Tiny.”</p>
          </li>
          <li>
            <h2>Review and publish</h2>
            <p>For featured animals, open <strong>Preview homepage</strong>, then tap <strong>Publish this draft</strong> in Telegram when it’s ready. The links expire after 30 minutes. If the draft changes, review the new preview before publishing.</p>
            <p>For animal profile drafts or featured replies with only a CMS link, open <strong>Review in the CMS</strong> and publish there when ready.</p>
            <p>To delete content, sign in to the CMS. Catministrator sends the login link when you ask to delete something.</p>
          </li>
        </ol>

        <section className="cms-help-admin" aria-labelledby="telegram-admin-title">
          <h2 id="telegram-admin-title">For administrators</h2>
          <p>In the CMS the bot uses, open {administrator ? <Link href={usersURL}>Settings → Users</Link> : <strong>Settings → Users</strong>}. Select the staff account, enter the number in <strong>Telegram ID</strong>, and save.</p>
          <p>To revoke access, clear <strong>Telegram ID</strong> and save again.</p>
          <p>The plain-language pilot uses GPT-6 Luna at medium effort with Vercel AI Gateway. Confirm Gateway access and set a request limit before enabling it.</p>
        </section>
        <p className="cms-help-note">{hosted
          ? 'If your demo asks for Vercel sign-in, sign in to view the preview. If the bot is quiet, ask an administrator to check its connection.'
          : 'For local drafts, open review links on the computer running the CMS. If the bot is quiet, ask an administrator to check its connection.'}</p>
      </article>
    </Gutter>
  </DefaultTemplate>
}
