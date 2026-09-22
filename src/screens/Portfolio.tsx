import { useMemo, useState } from 'react'
import { CardDetailSheet } from '../components/CardDetailSheet'
import { CardTile } from '../components/CardTile'
import { FilterSheet } from '../components/FilterSheet'
import { FilterIcon } from '../components/Icons'
import {
  activeFilterCount,
  applyFilters,
  formatAsOf,
  formatMoney,
  NO_FILTERS,
  oldestPriceTime,
  totalValue,
  type Filters,
} from '../lib/portfolio'
import { PRINTING_LABELS, type PortfolioItem } from '../lib/types'
import { usePortfolio } from '../lib/usePortfolio'
import '../components/Chips.css'
import '../components/Form.css'
import './Portfolio.css'
import './Screen.css'

const SORT_LABELS = { value: 'Value', name: 'Name', newest: 'Newest' } as const

export function Portfolio() {
  const { items, loading, error, reload, refresh, startRefresh, dismissNote } = usePortfolio()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selected, setSelected] = useState<PortfolioItem | null>(null)

  const shown = useMemo(() => applyFilters(items, filters), [items, filters])
  // The headline total is always the whole portfolio, never the filtered view.
  const total = useMemo(() => totalValue(items), [items])
  const asOf = useMemo(() => oldestPriceTime(items), [items])
  const filterCount = activeFilterCount(filters)

  // A chip names its group, or the single value chosen: "Printing: Holofoil".
  const onePrinting = filters.printings.length === 1 ? filters.printings[0] : undefined
  const oneRarity = filters.rarities.length === 1 ? filters.rarities[0] : undefined
  const oneType = filters.types.length === 1 ? filters.types[0] : undefined

  const chips: Array<{ key: string; label: string; on: boolean }> = [
    { key: 'set', label: chipLabel('Set', filters.sets.length), on: filters.sets.length > 0 },
    {
      key: 'printing',
      label: onePrinting ? `Printing: ${PRINTING_LABELS[onePrinting]}` : chipLabel('Printing', filters.printings.length),
      on: filters.printings.length > 0,
    },
    {
      key: 'rarity',
      label: oneRarity ? `Rarity: ${oneRarity}` : chipLabel('Rarity', filters.rarities.length),
      on: filters.rarities.length > 0,
    },
    {
      key: 'type',
      label: oneType ? `Type: ${oneType}` : chipLabel('Type', filters.types.length),
      on: filters.types.length > 0,
    },
    { key: 'sort', label: `Sort: ${SORT_LABELS[filters.sort]}`, on: false },
  ]

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

      {items.length > 0 && (
        <>
          <div className="search-row">
            <input
              className="field-input"
              type="search"
              placeholder="Search your collection"
              aria-label="Search your collection"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <button
              type="button"
              className="filter-button"
              onClick={() => setSheetOpen(true)}
              aria-label={`Filter and sort${filterCount ? `, ${filterCount} active` : ''}`}
            >
              <FilterIcon />
              {filterCount > 0 && <span className="filter-badge">{filterCount}</span>}
            </button>
          </div>

          <div className="chip-scroller">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`chip${chip.on ? ' chip-on' : ''}`}
                onClick={() => setSheetOpen(true)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {(filterCount > 0 || filters.search) && (
            <p className="muted showing">
              Showing {shown.length} of {items.length} cards
            </p>
          )}
        </>
      )}

      {loading ? (
        <p className="muted loading-note">Loading your cards…</p>
      ) : items.length === 0 ? (
        <section className="empty">
          <h2>Your collection will show up here</h2>
          <p className="muted">Add your first card to get started.</p>
        </section>
      ) : shown.length === 0 ? (
        <section className="empty">
          <h2>No cards match</h2>
          <p className="muted">Try clearing a filter.</p>
        </section>
      ) : (
        <div className="grid">
          {shown.map((item) => (
            <CardTile key={item.id} item={item} onOpen={() => setSelected(item)} />
          ))}
        </div>
      )}

      {sheetOpen && (
        <FilterSheet
          items={items}
          filters={filters}
          onChange={setFilters}
          onClose={() => setSheetOpen(false)}
          resultCount={shown.length}
        />
      )}

      {selected && (
        <CardDetailSheet item={selected} onClose={() => setSelected(null)} onChanged={reload} />
      )}

      {/* Keeps the refresh action reachable by keyboard and screen reader even
          though the visible control lives in the tab bar. */}
      <button type="button" className="visually-hidden" onClick={startRefresh}>
        Refresh prices
      </button>
    </main>
  )
}

function chipLabel(name: string, count: number): string {
  return count > 1 ? `${name} (${count})` : name
}
