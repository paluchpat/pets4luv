'use client'

import { useState } from 'react'
import type { AnimalPhotoDTO } from '@/lib/public-content'
import styles from './AnimalGallery.module.css'

export function AnimalGallery({ name, photos }: { name: string; photos: AnimalPhotoDTO[] }) {
  const [selected, setSelected] = useState(0)
  const current = photos[selected] || photos[0]

  return <div className={styles.gallery}>
    <div className={styles.main}>
      {current ? <img src={current.url} alt={current.alt || name} /> : <div className="missing-photo" role="img" aria-label={`Photo of ${name} not yet available`}>Photo coming soon</div>}
    </div>
    {photos.length > 1 && <div className={styles.thumbnails} role="group" aria-label={`Photos of ${name}`}>
      {photos.map((photo, index) => <button key={photo.url} type="button" className={styles.thumbnail} aria-label={`View photo ${index + 1} of ${name}`} aria-pressed={current === photo} onClick={() => setSelected(index)}>
        <img src={photo.url} alt="" loading="lazy" />
      </button>)}
    </div>}
  </div>
}
