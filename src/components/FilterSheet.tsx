import { useMemo, useState } from 'react'
import { NO_FILTERS, type Filters, type SortKey } from '../lib/portfolio'
import { PRINTING_LABELS, PRINTINGS, TYPE_COLORS, type PortfolioItem, type Printing } from '../lib/types'
import { Sheet } from './Sheet'
import './Chips.css'
import './Form.css'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'value', label: 'Value' },
  { key: 'name', label: 'Name' },
  { key: 'newest', label: 'Newest' },
]

/** How many pack chips to show before collapsing the rest behind "+ N more". */
const PACKS_SHOWN = 6

export function FilterSheet({
  items,
  filters,
  onChange,
  onClose,
  resultCount,
}: {
  items: PortfolioItem[]
  filters: Filters
  onChange: (next: Filters) => void
  onClose: () => void
  resultCount: number
}) {
  const [showAllPacks, setShowAllPacks] = useState(false)
  const [packSearch, setPackSearch] = useState('')

  // Every option comes from what is actually in the portfolio, so there are no
  // filters that could only ever return nothing.
  const { packs, rarities, types, printings } = useMemo(() => {
    const packMap = new Map<string, string>()
    const raritySet = new Set<string>()
    const typeSet = new Set<string>()
    const printingSet = new Set<Printing>()
    for (const item of items) {
      packMap.set(item.card.set_id, item.card.set_name)
      if (item.card.rarity) raritySet.add(item.card.rarity)
      for (const t of item.card.types) typeSet.add(t)
      printingSet.add(item.printing)
    }
    return {
      packs: [...packMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      rarities: [...raritySet].sort(),
      types: [...typeSet].sort(),
      printings: PRINTINGS.filter((p) => printingSet.has(p)),
    }
  }, [items])

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  const matchingPacks = packSearch
    ? packs.filter((p) => p.name.toLowerCase().includes(packSearch.toLowerCase()))
    : packs
  const visiblePacks = showAllPacks ? matchingPacks : matchingPacks.slice(0, PACKS_SHOWN)
  const hiddenPackCount = matchingPacks.length - visiblePacks.length

  return (
    <Sheet title="Filter and sort" onClose={onClose}>
      <div className="sheet-header">
        <h2>Filter &amp; sort</h2>
        <button type="button" className="text-button" onClick={() => onChange({ ...NO_FILTERS, search: filters.search })}>
          Reset
        </button>
      </div>

      <section className="sheet-section">
        <span className="label">Sort by</span>
        <div className="chip-row">
          {SORTS.map((sort) => (
            <button
              key={sort.key}
              type="button"
              className="chip"
              aria-pressed={filters.sort === sort.key}
              onClick={() => onChange({ ...filters, sort: sort.key })}
            >
              {sort.label}
            </button>
          ))}
        </div>
      </section>

      {packs.length > 0 && (
        <section className="sheet-section">
          <span className="label">Pack type</span>
          {showAllPacks && packs.length > PACKS_SHOWN && (
            <input
              className="field-input"
              type="search"
              placeholder="Search packs"
              aria-label="Search packs"
              value={packSearch}
              onChange={(e) => setPackSearch(e.target.value)}
              style={{ marginBottom: 10 }}
            />
          )}
          <div className="chip-row">
            {visiblePacks.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className="chip"
                aria-pressed={filters.sets.includes(pack.id)}
                onClick={() => onChange({ ...filters, sets: toggle(filters.sets, pack.id) })}
              >
                {pack.name}
              </button>
            ))}
            {hiddenPackCount > 0 && (
              <button type="button" className="chip" onClick={() => setShowAllPacks(true)}>
                + {hiddenPackCount} more
              </button>
            )}
          </div>
        </section>
      )}

      {printings.length > 0 && (
        <section className="sheet-section">
          <span className="label">Printing</span>
          <div className="chip-row">
            {printings.map((printing) => (
              <button
                key={printing}
                type="button"
                className="chip"
                aria-pressed={filters.printings.includes(printing)}
                onClick={() => onChange({ ...filters, printings: toggle(filters.printings, printing) })}
              >
                {PRINTING_LABELS[printing]}
              </button>
            ))}
          </div>
        </section>
      )}

      {rarities.length > 0 && (
        <section className="sheet-section">
          <span className="label">Rarity</span>
          <div className="chip-scroller">
            {rarities.map((rarity) => (
              <button
                key={rarity}
                type="button"
                className="chip"
                aria-pressed={filters.rarities.includes(rarity)}
                onClick={() => onChange({ ...filters, rarities: toggle(filters.rarities, rarity) })}
              >
                {rarity}
              </button>
            ))}
          </div>
        </section>
      )}

      {types.length > 0 && (
        <section className="sheet-section">
          <span className="label">Type</span>
          <div className="chip-scroller">
            {types.map((type) => (
              <button
                key={type}
                type="button"
                className="chip"
                aria-pressed={filters.types.includes(type)}
                onClick={() => onChange({ ...filters, types: toggle(filters.types, type) })}
              >
                <span className="type-dot" style={{ background: TYPE_COLORS[type] ?? 'var(--muted)' }} />
                {type}
              </button>
            ))}
          </div>
        </section>
      )}

      <button type="button" className="button-primary" onClick={onClose}>
        Show {resultCount} {resultCount === 1 ? 'card' : 'cards'}
      </button>
    </Sheet>
  )
}
