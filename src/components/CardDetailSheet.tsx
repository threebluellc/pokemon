import { useState } from 'react'
import { removeItem, updateItem } from '../lib/api'
import { formatAsOf } from '../lib/portfolio'
import { cardNumber, type Condition, type PortfolioItem, type Printing } from '../lib/types'
import { CardArt } from './CardArt'
import { CardOptions } from './CardOptions'
import { Sheet } from './Sheet'
import './Form.css'
import './CardDetailSheet.css'

export function CardDetailSheet({
  item,
  onClose,
  onChanged,
}: {
  item: PortfolioItem
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [printing, setPrinting] = useState<Printing>(item.printing)
  const [condition, setCondition] = useState<Condition>(item.condition)
  const [quantity, setQuantity] = useState(item.quantity)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const card = item.card
  const changed = printing !== item.printing || condition !== item.condition || quantity !== item.quantity

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await updateItem(item.id, { printing, condition, quantity })
      await onChanged()
      onClose()
    } catch (e) {
      setError(`! ${e instanceof Error ? e.message : 'Could not save that change.'}`)
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await removeItem(item.id)
      await onChanged()
      onClose()
    } catch (e) {
      setError(`! ${e instanceof Error ? e.message : 'Could not remove that card.'}`)
      setBusy(false)
    }
  }

  return (
    <Sheet title={card.name} onClose={onClose}>
      <header className="detail-header">
        <CardArt card={card} size="low" className="detail-art" />
        <div>
          <h2 className="detail-name">{card.name}</h2>
          <p className="muted">
            {card.set_name} · {cardNumber(card)}
          </p>
          {card.rarity && <p className="muted">{card.rarity}</p>}
        </div>
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <CardOptions
        card={card}
        printing={printing}
        condition={condition}
        quantity={quantity}
        onPrinting={setPrinting}
        onCondition={setCondition}
        onQuantity={setQuantity}
      />

      <p className="muted small">Price as of {formatAsOf(card.price_updated_at)}.</p>

      <button type="button" className="button-primary" disabled={!changed || busy} onClick={() => void save()}>
        {busy ? 'Saving…' : changed ? 'Save changes' : 'No changes'}
      </button>

      <button type="button" className="button-danger" disabled={busy} onClick={() => void remove()}>
        {confirmRemove ? 'Tap again to remove' : 'Remove from portfolio'}
      </button>
    </Sheet>
  )
}
