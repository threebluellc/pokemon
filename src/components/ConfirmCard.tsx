import { useState } from 'react'
import { addToPortfolio } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cardImage, cardNumber, TYPE_COLORS, type CachedCard, type Condition, type Printing } from '../lib/types'
import { CardOptions, likeliestPrinting } from './CardOptions'
import { BackIcon, CheckIcon } from './Icons'
import './Form.css'
import './CardDetailSheet.css'
import '../screens/AddCard.css'

/**
 * The last step before a card joins the portfolio. Used both after a photo and
 * after a manual search; with several candidates you can step between them.
 */
export function ConfirmCard({
  candidates,
  fromPhoto,
  onBack,
  onAdded,
  onManualSearch,
}: {
  candidates: CachedCard[]
  fromPhoto: boolean
  onBack: () => void
  onAdded: (message: string) => Promise<void>
  onManualSearch?: () => void
}) {
  const { session } = useAuth()
  const [index, setIndex] = useState(0)
  const card = candidates[index]

  // Keyed on the card id so switching candidates starts from that card's own
  // most likely printing rather than carrying the last one over.
  return card ? (
    <ConfirmOne
      key={card.card_id}
      card={card}
      position={index}
      total={candidates.length}
      fromPhoto={fromPhoto}
      userId={session?.user.id ?? ''}
      onBack={onBack}
      onAdded={onAdded}
      onManualSearch={onManualSearch}
      onStep={(delta) => setIndex((i) => Math.min(candidates.length - 1, Math.max(0, i + delta)))}
    />
  ) : null
}

function ConfirmOne({
  card,
  position,
  total,
  fromPhoto,
  userId,
  onBack,
  onAdded,
  onManualSearch,
  onStep,
}: {
  card: CachedCard
  position: number
  total: number
  fromPhoto: boolean
  userId: string
  onBack: () => void
  onAdded: (message: string) => Promise<void>
  onManualSearch?: () => void
  onStep: (delta: number) => void
}) {
  const [printing, setPrinting] = useState<Printing>(() => likeliestPrinting(card))
  const [condition, setCondition] = useState<Condition>('NM')
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const price = card.prices?.[printing]
  const image = cardImage(card, 'high')

  async function add() {
    setBusy(true)
    setError(null)
    try {
      const result = await addToPortfolio(userId, card.card_id, printing, condition, quantity)
      await onAdded(
        result.wasAlreadyOwned
          ? `${card.name}: now ${result.newQuantity} in your portfolio.`
          : `Added ${card.name} ×${quantity}.`,
      )
    } catch (e) {
      setError(`! ${e instanceof Error ? e.message : 'Could not add that card.'}`)
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <header className="confirm-top">
        <button type="button" className="icon-button" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <h1 className="confirm-title">Confirm card</h1>
      </header>

      <div className="detail-header">
        {image && <img className="detail-art" src={image} alt="" />}
        <div>
          {fromPhoto && (
            <span className="matched-pill">
              <CheckIcon /> Matched from photo
            </span>
          )}
          <h2 className="detail-name">{card.name}</h2>
          <p className="muted">
            {card.set_name} · {cardNumber(card)}
          </p>
          {card.rarity && <p className="muted">{card.rarity}</p>}
          {card.types.map((type) => (
            <p className="muted type-line" key={type}>
              <span className="type-dot" style={{ background: TYPE_COLORS[type] ?? 'var(--muted)' }} />
              {type}
            </p>
          ))}
        </div>
      </div>

      {total > 1 && (
        <div className="candidate-switch">
          <button type="button" onClick={() => onStep(-1)} disabled={position === 0}>
            Previous
          </button>
          <span className="muted">
            Match {position + 1} of {total}
          </span>
          <button type="button" onClick={() => onStep(1)} disabled={position === total - 1}>
            Next
          </button>
        </div>
      )}

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

      <button type="button" className="button-primary" disabled={busy || price == null} onClick={() => void add()}>
        {busy ? 'Adding…' : `Add to portfolio · $${((price ?? 0) * quantity).toFixed(2)}`}
      </button>

      {onManualSearch && (
        <button type="button" className="button-link" onClick={onManualSearch}>
          Not this card? Search manually
        </button>
      )}
    </main>
  )
}
