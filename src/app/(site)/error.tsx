'use client'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="page-shell error-page"><p className="section-label">A little pause</p><h1>We couldn’t load this page.</h1><p>The local content service is unavailable. Please try again in a moment.</p><button className="button" type="button" onClick={reset}>Try again</button></main>
}
