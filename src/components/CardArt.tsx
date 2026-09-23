import { useState } from 'react'
import { cardImage } from '../lib/types'
import './CardArt.css'

type ArtSource = { image_url: string | null; name: string }

/**
 * A card picture, or a readable stand-in.
 *
 * Not every card in TCGdex has artwork -- older promos and trainer kits often
 * have none -- and a URL can fail to load on a patchy connection. Either way an
 * empty grey box looks like a bug, so we name the card instead.
 */
export function CardArt({ card, size, className }: { card: ArtSource; size: 'low' | 'high'; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : cardImage(card, size)

  if (!src) {
    return (
      <span className={`card-art-none ${className ?? ''}`.trim()} aria-hidden="true">
        <span className="card-art-name">{card.name}</span>
        <span className="card-art-note">No picture</span>
      </span>
    )
  }

  return (
    <img className={className} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  )
}
