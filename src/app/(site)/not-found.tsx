import Link from 'next/link'

export default function NotFound() {
  return <main id="main" className="page-shell error-page"><p className="section-label">Let’s find your way</p><h1>We couldn’t find that page.</h1><p>The listing or information may no longer be published.</p><Link className="button" href="/animals">Explore available animals →</Link><Link className="text-link" href="/">Return home</Link></main>
}
