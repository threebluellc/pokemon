import { priceOf } from '../lib/portfolio'
import { cardNumber, PRINTING_LABELS, type PortfolioItem } from '../lib/types'
import { CardArt } from './CardArt'
import './CardTile.css'

export function CardTile({ item, onOpen }: { item: PortfolioItem; onOpen: () => void }) {
  const card = item.card
  const price = priceOf(item)

  return (
    <button type="button" className="tile" onClick={onOpen}>
      <span className="tile-art">
        <CardArt card={card} size="low" />
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
