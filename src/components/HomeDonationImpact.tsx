import Link from 'next/link'
import { Bone, Briefcase, House, Soup, SprayCan, Stethoscope } from 'lucide-react'
import styles from './HomeDonationImpact.module.css'

const donationUses = [
  {
    icon: Stethoscope,
    title: 'Veterinary care',
    description: 'Your gifts help cover veterinary costs for the cats and dogs in our care.',
  },
  {
    icon: House,
    title: 'Housing',
    description: 'Donations help us provide separate housing for cats and quarantine space for dogs.',
  },
  {
    icon: Soup,
    title: 'Food and treats',
    description: 'Canned dog food, Fancy Feast wet food for cats and kittens, and treats for both cats and dogs.',
  },
  {
    icon: SprayCan,
    title: 'Litter and cleaning supplies',
    description: 'Litter, trash bags, paper towels, sponges, and dog waste bags.',
  },
  {
    icon: Briefcase,
    title: 'Pet equipment',
    description: 'Cat carriers, martingale or limited-slip collars, and 6-foot leashes.',
  },
  {
    icon: Bone,
    title: 'Toys and grooming',
    description: 'Dog and cat toys, pet wipes, nail clippers, and flea combs.',
  },
]

export function HomeDonationImpact() {
  return (
    <section className={styles.section} aria-labelledby="donation-impact-title">
      <h2 id="donation-impact-title" className={styles.title}>How your donation helps</h2>
      <p className={styles.intro}>
        Any donation, whether it’s money or supplies, helps us care for the cats and dogs at Pets4Luv.
      </p>
      <ul className={styles.uses} role="list">
        {donationUses.map(({ icon: Icon, title, description }) => (
          <li key={title} className={styles.use}>
            <Icon aria-hidden="true" strokeWidth={1.6} />
            <h3>{title}</h3>
            <p>{description}</p>
          </li>
        ))}
      </ul>
      <Link className="button donate-button" href="/donate">Donate</Link>
    </section>
  )
}
