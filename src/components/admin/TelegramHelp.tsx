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
  { label: 'Update an animal’s short description', message: 'Set Fig’s summary to Sweet and playful.' },
  { label: 'Mark an animal as pending', message: 'Mark Tiny as pending.' },
  { label: 'Set the homepage featured list', message: 'Feature Fig first, then Frida and Bandit.' },
  { label: 'Change the lead animal', message: 'Make Tiny the lead featured animal.' },
  { label: 'Replace one featured animal', message: 'Replace Tiny with Mochachina in the featured list.' },
  { label: 'Replace wording on a page', message: 'On the Contact page, change “Visit on Saturday” to “Visit on Sunday.”' },
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
          <p>Use Catministrator in Telegram to draft animal profiles, add photos, update article text, and change the homepage’s featured animals.</p>
          <a className="cms-button cms-button-primary" href={botURL} target="_blank" rel="noopener noreferrer">
            Open Telegram bot<ArrowUpRight aria-hidden="true" /><span className="cms-sr-only"> (opens in a new tab)</span>
          </a>
        </header>

        <ol className="cms-help-steps" role="list">
          <li>
            <h2>Link your Telegram account</h2>
            <p>Open a private chat with <strong>{telegramHelp.username}</strong> and tap <strong>Start</strong>. Share the numeric ID in the reply with a Pets4Luv administrator, who can link it to your CMS account.</p>
          </li>
          <li>
            <h2>Describe what you’d like to change</h2>
            <p>Once linked, message Catministrator as you would a coworker. Include the animal’s name or the page title and describe the change you want. Telegram shows a typing indicator while Catministrator prepares its reply.</p>
            <dl className="cms-help-examples">
              {examples.map(({ label, message }) => <div key={label}>
                <dt>{label}</dt>
                <dd><q>{message}</q></dd>
              </div>)}
            </dl>
            <p>Choose up to three published, available animals when setting the full featured list. The first animal gets the large photo.</p>
            <p>If a name needs clarification, tap a suggested animal or reply “I meant Mochachina.” To clear the pending clarification, say “Never mind.”</p>
          </li>
          <li>
            <h2>Send photos and intake details together</h2>
            <p>Send an album with the animal’s photos and any intake sheet. A caption like “Add this cat” starts a new profile. To update a profile, say which animal the photos are for.</p>
            <p>Catministrator reads the intake sheet and shows the details it found, including age, weight, and compatibility when the form includes them. It suggests only coat colors and patterns it can identify with high confidence, with the dominant color first. The rescue intake ID and medical notes go into staff-only CMS fields. Unreadable or unreported values are left blank. Check the details and planned gallery photos, then tap <strong>Create animal draft</strong> or <strong>Save animal draft</strong>.</p>
            <p>If the print is too small, send a close-up of the sheet or attach the original as a file. You can ask it to add those details to an existing animal’s draft. Say “Never mind” to clear pending work. Draft proposals expire after 30 minutes.</p>
          </li>
          <li>
            <h2>Review and publish</h2>
            <p>Open <strong>Preview animal page</strong> to see the draft as it will appear on the site. You can also ask for an existing draft by name, such as “Preview Rowan.” For a complete profile, tap <strong>Publish this draft</strong> in Telegram after reviewing.</p>
            <p>For featured animals, open <strong>Preview homepage</strong>, then tap <strong>Publish this draft</strong> in Telegram when it’s ready. The links expire after 30 minutes. If the draft changes, review the new preview before publishing.</p>
            <p>After publishing featured animals, tap <strong>Undo featured publish</strong> or say “undo last action” to restore the previous live order. Undo applies to your publication while it’s still current. Review any newer featured draft in the CMS first.</p>
            <p>To discard a saved featured draft, open <strong>Review in the CMS</strong> and choose <strong>Discard draft</strong> from the three-dot menu.</p>
            <p>For article drafts or featured replies with only a CMS link, open <strong>Review in the CMS</strong> and publish there when ready.</p>
            <p>To delete content, sign in to the CMS. Catministrator sends the login link when you ask to delete something.</p>
          </li>
        </ol>

        <section className="cms-help-admin" aria-labelledby="telegram-admin-title">
          <h2 id="telegram-admin-title">For administrators</h2>
          <p>In the CMS the bot uses, open {administrator ? <Link href={usersURL}>Settings → Users</Link> : <strong>Settings → Users</strong>}. Select the staff account, enter the number in <strong>Telegram ID</strong>, and save.</p>
          <p>To revoke access, clear <strong>Telegram ID</strong> and save again.</p>
          <p>Catministrator checks the sender against the CMS before sending their message and attachments to GPT-6 Luna through Vercel AI Gateway. The configured request limit covers all model calls. Photo intake currently saves to the local CMS.</p>
        </section>
        <p className="cms-help-note">{hosted
          ? 'If your demo asks for Vercel sign-in, sign in to view the preview. If the bot is quiet, ask an administrator to check its connection.'
          : 'For local drafts, open review links on the computer running the CMS. If the bot is quiet, ask an administrator to check its connection.'}</p>
      </article>
    </Gutter>
  </DefaultTemplate>
}
