import { useState, type FormEvent } from 'react'
import { BackIcon, CheckIcon, SearchIcon } from '../components/Icons'
import { CardOptions, likeliestPrinting } from '../components/CardOptions'
import { addToPortfolio, getCards, searchCards } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePortfolio } from '../lib/usePortfolio'
import { cardImage, cardNumber, TYPE_COLORS, type CachedCard, type Condition, type Printing, type SearchHit } from '../lib/types'
import '../components/Chips.css'
import '../components/Form.css'
import '../components/CardDetailSheet.css'
import './AddCard.css'
import './Screen.css'

// Phase 2 adds cards by searching. Phase 3 puts the camera in front of this,
// with this search kept as the "not this card?" fallback.
export function AddCard() {
  const { session } = useAuth()
  const { reload } = usePortfolio()
  const [query, setQuery] = useState('')
  const [number, setNumber] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [chosen, setChosen] = useState<CachedCard | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function runSearch(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      setHits(await searchCards(query.trim(), number.trim() || undefined))
    } catch (e) {
      setError(`! ${e instanceof Error ? e.message : 'Search failed.'}`)
    } finally {
      setBusy(false)
    }
  }

  // Picking a result is the moment we fetch prices: one lookup, cached for both of us.
  async function choose(hit: SearchHit) {
    setError(null)
    setBusy(true)
    try {
      const [card] = await getCards([hit.card_id])
      if (!card) throw new Error('That card could not be loaded.')
      setChosen(card)
    } catch (e) {
      setError(`! ${e instanceof Error ? e.message : 'Could not load that card.'}`)
    } finally {
      setBusy(false)
    }
  }

  if (chosen) {
    return (
      <ConfirmCard
        card={chosen}
        userId={session?.user.id ?? ''}
        onBack={() => setChosen(null)}
        onAdded={async (message) => {
          await reload()
          setChosen(null)
          setToast(message)
        }}
      />
    )
  }

  return (
    <main className="screen">
      <h1 className="title">Add a card</h1>
      <p className="muted subtitle">Search by name, and narrow it down with the collector number.</p>

      {toast && (
        <button type="button" className="toast" onClick={() => setToast(null)}>
          {toast} <span aria-hidden="true">✕</span>
        </button>
      )}

      <form onSubmit={runSearch} noValidate>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span className="field-label">Card name</span>
          <input
            className="field-input"
            type="search"
            autoCapitalize="none"
            placeholder="Munna"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Collector number (optional)</span>
          <input
            className="field-input"
            type="text"
            inputMode="numeric"
            placeholder="116"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
          />
          <p className="field-hint">On a card numbered 116/086, type 116.</p>
        </label>
        <button className="button-primary" type="submit" disabled={busy || query.trim().length < 2}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {hits && (
        <section className="results">
          <h2 className="label">
            {hits.length === 0 ? 'No matches' : `${hits.length} ${hits.length === 1 ? 'match' : 'matches'}`}
          </h2>
          {hits.length === 0 && <p className="muted">Check the spelling, or try without the number.</p>}
          <ul className="result-list">
            {hits.map((hit) => (
              <li key={hit.card_id}>
                <button type="button" className="result-row" disabled={busy} onClick={() => void choose(hit)}>
                  <span className="result-art">
                    {cardImage(hit, 'low') && <img src={cardImage(hit, 'low')!} alt="" loading="lazy" />}
                  </span>
                  <span className="result-text">
                    <span className="result-name">{hit.name}</span>
                    <span className="muted">
                      {hit.set_name} · {cardNumber(hit)}
                    </span>
                  </span>
                  <SearchIcon />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

function ConfirmCard({
  card,
  userId,
  onBack,
  onAdded,
}: {
  card: CachedCard
  userId: string
  onBack: () => void
  onAdded: (message: string) => Promise<void>
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
        <button type="button" className="icon-button" onClick={onBack} aria-label="Back to search">
          <BackIcon />
        </button>
        <h1 className="confirm-title">Confirm card</h1>
      </header>

      <div className="detail-header">
        {image && <img className="detail-art" src={image} alt="" />}
        <div>
          <span className="matched-pill">
            <CheckIcon /> Matched
          </span>
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
    </main>
  )
}
