import { useMemo } from 'react'
import type { Dish } from '../api/api'
import { formatCurrency } from '../lib/format'
import { CATEGORY_OPTIONS } from '../lib/categories'
import { IconMinus, IconPlus, IconSearch } from './icons'

// Shared between Billing (walk-in orders) and TableOrder (dine-in) -- both
// need the same sticky Find Dish + category filter bar, category-grouped
// list sorted by the fixed CATEGORY_OPTIONS order, and qty steppers.
export default function DishGrid({
  dishes,
  cart,
  onAdjustQty,
  loading,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
}: {
  dishes: Dish[]
  cart: Record<string, number>
  onAdjustQty: (dishId: string, delta: number) => void
  loading: boolean
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryFilterChange: (value: string) => void
}) {
  const categories = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = dishes.filter((d) => {
      if (categoryFilter && d.Category !== categoryFilter) return false
      if (q && !d.Name.toLowerCase().includes(q)) return false
      return true
    })
    const groups = new Map<string, Dish[]>()
    filtered.forEach((d) => {
      const list = groups.get(d.Category) ?? []
      list.push(d)
      groups.set(d.Category, list)
    })
    return Array.from(groups.entries()).sort((a, b) => {
      const ai = CATEGORY_OPTIONS.indexOf(a[0])
      const bi = CATEGORY_OPTIONS.indexOf(b[0])
      return (ai === -1 ? CATEGORY_OPTIONS.length : ai) - (bi === -1 ? CATEGORY_OPTIONS.length : bi)
    })
  }, [dishes, search, categoryFilter])

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 bg-slate-50 px-4 pb-3 pt-4">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Find Dish"
              disabled={loading}
              className="h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            disabled={loading}
            className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
        </div>
      )}

      {!loading &&
        categories.map(([category, items]) => (
          <div key={category}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{category}</h2>
            <div className="flex flex-col gap-2">
              {items.map((dish) => (
                <div key={dish.Id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{dish.Name}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(Number(dish.Price))}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onAdjustQty(dish.Id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                    >
                      <IconMinus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{cart[dish.Id] ?? 0}</span>
                    <button
                      onClick={() => onAdjustQty(dish.Id, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-white"
                    >
                      <IconPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      {!loading && categories.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">No dishes match. Add some in Menu.</p>
      )}
    </>
  )
}
