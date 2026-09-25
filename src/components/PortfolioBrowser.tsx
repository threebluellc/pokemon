import { useMemo, useState } from 'react'
import { activeFilterCount, applyFilters, NO_FILTERS, type Filters } from '../lib/portfolio'
import { PRINTING_LABELS, type PortfolioItem } from '../lib/types'
import { CardTile } from './CardTile'
import { FilterSheet } from './FilterSheet'
import { FilterIcon } from './Icons'
import './Chips.css'
import './Form.css'
import '../screens/Portfolio.css'

const SORT_LABELS = { value: 'Value', name: 'Name', newest: 'Newest' } as const

/**
 * Search, filter chips and the card grid.
 *
 * Shared by your own portfolio and a friend's, so both behave the same way.
 * Leaving out `onOpenItem` makes the grid read-only: the tiles stop being
 * buttons rather than looking tappable and doing nothing.
 */
export function PortfolioBrowser({
  items,
  searchLabel,
  emptyTitle,
  emptyBody,
  onOpenItem,
}: {
  items: PortfolioItem[]
  searchLabel: string
  emptyTitle: string
  emptyBody: string
  onOpenItem?: (item: PortfolioItem) => void
}) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)

  const shown = useMemo(() => applyFilters(items, filters), [items, filters])
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

  if (items.length === 0) {
    return (
      <section className="empty">
        <h2>{emptyTitle}</h2>
        <p className="muted">{emptyBody}</p>
      </section>
    )
  }

  return (
    <>
      <div className="search-row">
        <input
          className="field-input"
          type="search"
          placeholder={searchLabel}
          aria-label={searchLabel}
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

      {shown.length === 0 ? (
        <section className="empty">
          <h2>No cards match</h2>
          <p className="muted">Try clearing a filter.</p>
        </section>
      ) : (
        <div className="grid">
          {shown.map((item) => (
            <CardTile key={item.id} item={item} onOpen={onOpenItem ? () => onOpenItem(item) : undefined} />
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
    </>
  )
}

function chipLabel(name: string, count: number): string {
  return count > 1 ? `${name} (${count})` : name
}
