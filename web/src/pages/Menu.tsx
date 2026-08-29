import { useEffect, useMemo, useState } from 'react'
import { api, type Dish } from '../api/api'
import { formatCurrency } from '../lib/format'
import { IconPlus } from '../components/icons'

const emptyForm = { Id: '', Name: '', Category: '', Price: '', Active: 'Y' as 'Y' | 'N' }

export default function Menu() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

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
    const groups = new Map<string, Dish[]>()
    dishes.forEach((d) => {
      const list = groups.get(d.Category) ?? []
      list.push(d)
      groups.set(d.Category, list)
    })
    return Array.from(groups.entries())
  }, [dishes])

  function openEdit(dish: Dish) {
    setForm({ Id: dish.Id, Name: dish.Name, Category: dish.Category, Price: String(dish.Price), Active: dish.Active })
    setShowForm(true)
  }

  function openNew() {
    setForm(emptyForm)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.Name || !form.Category || !form.Price) return
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
    await api.saveDish({ Id: dish.Id, Active: dish.Active === 'Y' ? 'N' : 'Y' })
    await load()
  }

  return (
    <div className="px-4 py-4">
      <button
        onClick={openNew}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white"
      >
        <IconPlus className="h-4 w-4" /> Add Dish
      </button>

      {loading && <p className="text-center text-sm text-gray-400">Loading…</p>}

      {categories.map(([category, items]) => (
        <div key={category} className="mb-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{category}</h2>
          <div className="flex flex-col gap-2">
            {items.map((dish) => (
              <div key={dish.Id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
                <button className="text-left" onClick={() => openEdit(dish)}>
                  <p className="text-sm font-semibold text-gray-800">{dish.Name}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(Number(dish.Price))}</p>
                </button>
                <button
                  onClick={() => toggleActive(dish)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    dish.Active === 'Y' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {dish.Active === 'Y' ? 'Active' : 'Inactive'}
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
            <div className="flex flex-col gap-2">
              <input
                value={form.Name}
                onChange={(e) => setForm({ ...form, Name: e.target.value })}
                placeholder="Dish name"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                value={form.Category}
                onChange={(e) => setForm({ ...form, Category: e.target.value })}
                placeholder="Category (e.g. Starters)"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={form.Price}
                onChange={(e) => setForm({ ...form, Price: e.target.value })}
                placeholder="Price"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600">
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
