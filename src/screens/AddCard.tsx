import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmCard } from '../components/ConfirmCard'
import { BackIcon, SearchIcon } from '../components/Icons'
import { getCards, searchCards } from '../lib/api'
import { usePortfolio } from '../lib/usePortfolio'
import { cardImage, cardNumber, type CachedCard, type SearchHit } from '../lib/types'
import '../components/Chips.css'
import '../components/Form.css'
import './AddCard.css'
import './Screen.css'

/** Searching for a card by hand: the fallback when the camera cannot read one. */
export function AddCard() {
  const navigate = useNavigate()
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
        candidates={[chosen]}
        fromPhoto={false}
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
      <header className="confirm-top">
        <button type="button" className="icon-button" onClick={() => navigate('/camera')} aria-label="Back to camera">
          <BackIcon />
        </button>
        <h1 className="confirm-title">Search for a card</h1>
      </header>

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
