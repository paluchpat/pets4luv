import Link from 'next/link'
import { galleryResultsHeadingId } from '@/lib/gallery-filters'
import { Icon } from './Icons'
import { FilterSelect } from './FilterSelect'
import { SpeciesPicker } from './SpeciesPicker'
import { ageOptions, genderOptions } from './filter-options'

export function SearchPanel() {
  return <section className="search-panel" aria-labelledby="find-title">
    <div className="search-heading"><h2 id="find-title">Find your furry best friend</h2><Link className="text-link" href="/animals">View all animals <span aria-hidden="true">→</span></Link></div>
    <form action={`/animals#${galleryResultsHeadingId}`} className="home-filters" method="get">
      <SpeciesPicker showLabel />
      <FilterSelect label="Age" name="ageGroup" options={ageOptions} />
      <FilterSelect label="Gender" name="gender" options={genderOptions} />
      <button className="button matching-button" type="submit">Show matching pets <Icon kind="arrow" /></button>
    </form>
    <p className="search-resources">
      Read about <Link href="/info/adoption">adoption</Link>, <Link href="/info/volunteering">volunteering</Link>, or get the <Link href="/applications">application forms</Link>.
    </p>
  </section>
}
