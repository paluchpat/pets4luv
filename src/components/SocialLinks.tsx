import { Facebook, Instagram } from 'lucide-react'

export function SocialLinks() {
  return (
    <div className="social-links">
      <a href="https://www.instagram.com/pets4luvfoundation/">
        <Instagram aria-hidden="true" focusable="false" />
        <span>Instagram</span>
      </a>
      <a href="https://www.facebook.com/Pets4Luv/">
        <Facebook aria-hidden="true" focusable="false" />
        <span>Facebook</span>
      </a>
    </div>
  )
}
