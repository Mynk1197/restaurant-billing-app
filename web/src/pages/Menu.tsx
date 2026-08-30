import { useEffect, useMemo, useState } from 'react'
import { api, type Dish } from '../api/api'
import { formatCurrency } from '../lib/format'
import { IconPlus, IconEdit, IconSearch } from '../components/icons'
import Banner from '../components/Banner'

const CATEGORY_OPTIONS = [
  'Starter (Veg)',
  'Starter (Non-Veg)',
  'Soups & Salads',
  'Main Course (Veg)',
  'Main Course (Non-Veg)',
  'Dessert',
  'Beverage',
]

const emptyForm = { Id: '', Name: '', Category: '', Price: '', Active: 'Y' as 'Y' | 'N' }

export default function Menu() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  async function load() {
    setLoading(true)
    const all = await api.getDishes(false)
    setDishes(all)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

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
    return Array.from(groups.entries())
  }, [dishes, search, categoryFilter])

  function openEdit(dish: Dish) {
    setForm({ Id: dish.Id, Name: dish.Name, Category: dish.Category, Price: String(dish.Price), Active: dish.Active })
    setError(null)
    setShowForm(true)
  }

  function openNew() {
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.Name.trim() || !form.Category || !form.Price.trim()) {
      setError('Dish name, category, and price are all required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await api.saveDish({
        Id: form.Id || undefined,
        Name: form.Name,
        Category: form.Category,
        Price: Number(form.Price),
        Active: form.Active,
      })
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(dish: Dish) {
    setSaving(true)
    try {
      await api.saveDish({ Id: dish.Id, Active: dish.Active === 'Y' ? 'N' : 'Y' })
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-4">
      {/* top-14 clears TopBar's height so this doesn't get tucked behind the
          sticky header the same way the message banners were. */}
      <div className="sticky top-14 z-10 -mx-4 mb-4 bg-slate-50 px-4 pb-3 pt-1">
        <button
          onClick={openNew}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          <IconPlus className="h-4 w-4" /> Add Dish
        </button>

        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dish name"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm text-gray-800"
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

      {loading && <p className="text-center text-sm text-gray-400">Loading…</p>}
      {!loading && categories.length === 0 && <p className="text-center text-sm text-gray-400">No dishes match.</p>}

      {categories.map(([category, items]) => (
        <div key={category} className="mb-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{category}</h2>
          <div className="flex flex-col gap-2">
            {items.map((dish) => (
              <div key={dish.Id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(dish)}
                    disabled={saving}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 disabled:opacity-40"
                  >
                    <IconEdit className="h-4 w-4" />
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{dish.Name}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(Number(dish.Price))}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(dish)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
                    dish.Active === 'Y' ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  aria-label={dish.Active === 'Y' ? 'Active — tap to deactivate' : 'Inactive — tap to activate'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      dish.Active === 'Y' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-bold text-gray-800">{form.Id ? 'Edit Dish' : 'New Dish'}</h3>
            {error && (
              <div className="mb-2">
                <Banner tone="error">{error}</Banner>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500">
                Dish name <span className="text-rose-500">*</span>
                <input
                  value={form.Name}
                  onChange={(e) => setForm({ ...form, Name: e.target.value })}
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </label>
              <label className="text-xs text-gray-500">
                Category <span className="text-rose-500">*</span>
                <select
                  value={form.Category}
                  onChange={(e) => setForm({ ...form, Category: e.target.value })}
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-gray-500">
                Price <span className="text-rose-500">*</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.Price}
                  onChange={(e) => setForm({ ...form, Price: e.target.value })}
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
