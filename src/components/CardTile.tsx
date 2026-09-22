import { priceOf } from '../lib/portfolio'
import { cardImage, cardNumber, PRINTING_LABELS, type PortfolioItem } from '../lib/types'
import './CardTile.css'

export function CardTile({ item, onOpen }: { item: PortfolioItem; onOpen: () => void }) {
  const card = item.card
  const price = priceOf(item)
  const image = cardImage(card, 'low')

  return (
    <button type="button" className="tile" onClick={onOpen}>
      <span className="tile-art">
        {image && <img src={image} alt="" loading="lazy" decoding="async" />}
      </span>

      <span className="tile-name">{card.name}</span>
      <span className="tile-meta">
        {card.set_name} · {cardNumber(card)}
      </span>
      {card.rarity && <span className="tile-meta">{card.rarity}</span>}

      <span className="tile-badges">
        <span className="badge">{item.condition}</span>
        <span className="badge badge-accent">{PRINTING_LABELS[item.printing]}</span>
      </span>

      <span className="tile-footer">
        <span className="tile-price">{price == null ? 'No price' : `$${price.toFixed(2)}`}</span>
        <span className="tile-qty">Qty {item.quantity}</span>
      </span>
    </button>
  )
}
