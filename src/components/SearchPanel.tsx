import Link from 'next/link'
import { galleryResultsHeadingId } from '@/lib/gallery-filters'
// import { AskPets4Luv } from './AskPets4Luv'
import { Icon } from './Icons'
import { FilterSelect } from './FilterSelect'
import { SpeciesPicker } from './SpeciesPicker'
import { ageOptions, genderOptions } from './filter-options'

export function SearchPanel() {
  const resourceLinks = <>Read about <Link href="/info/adoption">adoption</Link>, <Link href="/info/volunteering">volunteering</Link>, or get the <Link href="/applications">application forms</Link>.</>

  return <section className="search-panel" aria-labelledby="find-title">
    <div className="search-heading"><h2 id="find-title">Find your furry best friend</h2><Link className="text-link" href="/animals">View all animals <span aria-hidden="true">→</span></Link></div>
    <form action={`/animals#${galleryResultsHeadingId}`} className="home-filters" id="home-animal-search" method="get">
      <SpeciesPicker showLabel />
      <FilterSelect label="Age" name="ageGroup" options={ageOptions} className="filter-select-age" />
      <FilterSelect label="Gender" name="gender" options={genderOptions} />
      <button className="button matching-button" type="submit">Show matching pets <Icon kind="arrow" /></button>
    </form>
    {/* <AskPets4Luv resourceLinks={resourceLinks} /> */}
    <p className="search-resources">{resourceLinks}</p>
  </section>
}
