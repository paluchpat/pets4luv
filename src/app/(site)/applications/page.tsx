import { pageMetadata } from '@/lib/seo'
import { getWebsiteSettings } from '@/lib/content'
import { phoneHref as contactPhoneHref } from '@/lib/website-settings'

export const metadata = pageMetadata({
  title: 'Forms and applications',
  description: 'Find Pets4Luv forms for adopting, fostering, volunteering, and requesting help for a pet.',
  path: '/applications',
})
export const dynamic = 'force-dynamic'

const formDirectory = 'https://irp.cdn-website.com/664b757c/files/uploaded/'

type Application = { title: string; description?: string } & (
  | { file: string }
  | { subject: string; action?: 'Request information'; phone?: boolean }
)

type ApplicationGroup = { id: string; title: string; forms: Application[] }

const groups: ApplicationGroup[] = [
  {
    id: 'adopt-or-foster', title: 'Adopt or foster',
    forms: [
      { title: 'Cat adoption', file: 'Feline_Adoption_Application_-_updated.docx' },
      { title: 'Dog adoption', file: 'Canine_Adoption_Application_-_updated.docx' },
      { title: 'Foster an animal', file: 'Foster_Application_-_updated.docx' },
      { title: 'Senior and terminally ill programs', subject: 'Senior and terminally ill programs', action: 'Request information', phone: true },
    ],
  },
  {
    id: 'volunteer', title: 'Volunteer',
    forms: [
      { title: 'General volunteering', subject: 'General volunteer application' },
      { title: 'Community service', file: 'Volunteer_Application_-_community_Service.docx' },
      { title: 'Organization or group volunteering', file: 'Organizational_Volunteer_Application.docx' },
      { title: 'Reading program', file: 'Reading_Program_Application.docx' },
    ],
  },
  {
    id: 'get-help', title: 'Get help for your pet',
    forms: [
      { title: 'Medical assistance', description: 'For necessary, non-routine veterinary care when cost is a barrier.', subject: 'Medical assistance application', phone: true },
      { title: 'Pet food pantry', description: 'For pet owners who need help affording food.', subject: 'Pet food pantry application', phone: true },
    ],
  },
  {
    id: 'surrender', title: 'Surrender a pet',
    forms: [
      { title: 'Surrender application', subject: 'Pet surrender application', phone: true },
    ],
  },
]

export default async function ApplicationsPage() {
  const settings = await getWebsiteSettings()
  const email = settings.emailAddress
  const phone = settings.phone
  const phoneHref = contactPhoneHref(phone)
  return <main id="main" className="page-shell information-page applications-page">
    <p className="section-label">Pets4Luv information</p>
    <div className="page-intro">
      <h1>Applications</h1>
      <p>Download and print the available form you need. Bring your completed application to {settings.address}. If you have questions, call <a href={phoneHref}>{phone}</a> or email <a href={`mailto:${email}`}>{email}</a>.</p>
    </div>
    <nav className="application-jump-links" aria-label="Application categories">
      {groups.map(({ id, title }) => <a key={id} className="button secondary" href={`#${id}`}>{title}</a>)}
    </nav>
    {groups.map(({ id, title, forms }) => <section key={id} id={id} className="application-group" tabIndex={-1} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <ul className="application-list" role="list">
        {forms.map(form => {
          const isDownload = 'file' in form
          const href = isDownload ? `${formDirectory}${form.file}` : `mailto:${email}?subject=${encodeURIComponent(form.subject)}`
          const label = isDownload ? 'Word form (.docx)' : form.action || 'Request application'
          return <li key={form.title}>
            <div>
              <h3>{form.title}</h3>
              {form.description && <p>{form.description}</p>}
            </div>
            <div className="application-actions">
              <a className="button secondary" href={href} aria-label={`${label} for ${form.title}`}>{label}</a>
              {!isDownload && form.phone && <a className="text-link" href={phoneHref} aria-label={`Call ${phone} about ${form.title}`}>Call {phone}</a>}
            </div>
          </li>
        })}
      </ul>
    </section>)}
  </main>
}
