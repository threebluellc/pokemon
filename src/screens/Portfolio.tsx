import { useMemo, useState } from 'react'
import { CardDetailSheet } from '../components/CardDetailSheet'
import { PortfolioBrowser } from '../components/PortfolioBrowser'
import { formatAsOf, formatMoney, oldestPriceTime, totalValue } from '../lib/portfolio'
import type { PortfolioItem } from '../lib/types'
import { usePortfolio } from '../lib/usePortfolio'
import '../components/Form.css'
import './Portfolio.css'
import './Screen.css'

export function Portfolio() {
  const { items, loading, error, reload, refresh, startRefresh, dismissNote } = usePortfolio()
  const [selected, setSelected] = useState<PortfolioItem | null>(null)

  // The headline total is always the whole portfolio, never the filtered view.
  const total = useMemo(() => totalValue(items), [items])
  const asOf = useMemo(() => oldestPriceTime(items), [items])

  return (
    <main className="screen">
      <p className="label">Portfolio value</p>
      <p className="big-number">{formatMoney(total)}</p>

      {refresh.running ? (
        <div className="refresh-status">
          <p className="muted" aria-live="polite">
            {/* The total is unknown until the server answers with the card list. */}
            {refresh.total === 0
              ? 'Updating prices…'
              : `Updating prices · ${refresh.done} of ${refresh.total} cards`}
          </p>
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={refresh.done}
            aria-valuemin={0}
            aria-valuemax={refresh.total || 1}
          >
            <span style={{ width: `${refresh.total ? (refresh.done / refresh.total) * 100 : 0}%` }} />
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="muted">TCGplayer market prices, Near Mint</p>
      ) : (
        <p className="muted">TCGplayer market prices · as of {formatAsOf(asOf)}</p>
      )}

      {refresh.note && (
        <button type="button" className="toast" onClick={dismissNote}>
          {refresh.note} <span aria-hidden="true">✕</span>
        </button>
      )}

      {error && (
        <p className="form-error" role="alert">
          ! {error}
        </p>
      )}

      {loading ? (
        <p className="muted loading-note">Loading your cards…</p>
      ) : (
        <PortfolioBrowser
          items={items}
          searchLabel="Search your collection"
          emptyTitle="Your collection will show up here"
          emptyBody="Add your first card to get started."
          onOpenItem={setSelected}
        />
      )}

      {selected && <CardDetailSheet item={selected} onClose={() => setSelected(null)} onChanged={reload} />}

      {/* Keeps the refresh action reachable by keyboard and screen reader even
          though the visible control lives in the tab bar. */}
      <button type="button" className="visually-hidden" onClick={startRefresh}>
        Refresh prices
      </button>
    </main>
  )
}
