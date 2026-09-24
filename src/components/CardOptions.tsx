import { CONDITIONS, PRINTING_LABELS, PRINTINGS, type CachedCard, type Condition, type Printing } from '../lib/types'
import './CardOptions.css'

/** What each grade actually means, since the abbreviations give nothing away. */
const CONDITION_NOTES: Record<Condition, string> = {
  NM: 'Near Mint — no visible wear',
  LP: 'Lightly Played — minor edge wear or scuffing',
  MP: 'Moderately Played — noticeable wear, may have creasing',
  HP: 'Heavily Played — significant wear, creasing, or scratches',
  DMG: 'Damaged — bends, tears, water damage, or heavy wear',
}

/**
 * Printing, condition and quantity pickers. Shared by the add-a-card screen and
 * the detail sheet so both behave identically.
 */
export function CardOptions({
  card,
  printing,
  condition,
  quantity,
  onPrinting,
  onCondition,
  onQuantity,
}: {
  card: CachedCard
  printing: Printing
  condition: Condition
  quantity: number
  onPrinting: (value: Printing) => void
  onCondition: (value: Condition) => void
  onQuantity: (value: number) => void
}) {
  return (
    <>
      <section className="sheet-section">
        <span className="label">Printing</span>
        <div className="printing-row">
          {PRINTINGS.map((option) => {
            const price = card.prices?.[option]
            // TCGdex has no price for this printing, so this card almost certainly
            // was not printed that way. Show it, but do not let it be chosen.
            const unavailable = price == null
            return (
              <button
                key={option}
                type="button"
                className="printing-tile"
                aria-pressed={printing === option}
                disabled={unavailable}
                onClick={() => onPrinting(option)}
              >
                <span className="printing-name">{PRINTING_LABELS[option]}</span>
                <span className="printing-price">{unavailable ? '—' : `$${price.toFixed(2)}`}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="sheet-section">
        <span className="label">Condition</span>
        <div className="condition-row">
          {CONDITIONS.map((option) => (
            <button
              key={option}
              type="button"
              className="condition-button"
              aria-pressed={condition === option}
              onClick={() => onCondition(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {/* Two separate facts: what the grade you picked means, and the fact
            that the price does not move with it. */}
        <p className="condition-note" aria-live="polite">
          {CONDITION_NOTES[condition]}
        </p>
        <p className="muted small">Prices are Near Mint market values; we do not adjust them by condition.</p>
      </section>

      <section className="sheet-section">
        <span className="label">Quantity</span>
        <div className="stepper">
          <button type="button" onClick={() => onQuantity(Math.max(1, quantity - 1))} aria-label="One fewer">
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => onQuantity(Math.min(9999, quantity + 1))} aria-label="One more">
            +
          </button>
        </div>
      </section>
    </>
  )
}

/** The printing we pre-select: the only one priced, else the dearest. */
export function likeliestPrinting(card: CachedCard): Printing {
  const [first, ...rest] = PRINTINGS.filter((p) => card.prices?.[p] != null)
  if (!first) return 'normal'
  return rest.reduce((best, p) => ((card.prices[p] ?? 0) > (card.prices[best] ?? 0) ? p : best), first)
}
