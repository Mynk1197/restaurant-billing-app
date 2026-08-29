import { useEffect, useState } from 'react'
import { api, type Settings } from '../api/api'

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then(setForm)
  }, [])

  async function handleSave() {
    if (!form) return
    setSaving(true)
    setSaved(false)
    try {
      const updated = await api.saveSettings(form)
      setForm(updated)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <p className="px-4 py-8 text-center text-sm text-gray-400">Loading…</p>

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Restaurant details</h2>
        <div className="flex flex-col gap-2">
          <input
            value={form.RestaurantName}
            onChange={(e) => setForm({ ...form, RestaurantName: e.target.value })}
            placeholder="Restaurant name"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={form.Address}
            onChange={(e) => setForm({ ...form, Address: e.target.value })}
            placeholder="Address"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={form.Phone}
            onChange={(e) => setForm({ ...form, Phone: e.target.value })}
            placeholder="Phone"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">GST rates</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-500">
            SGST %
            <input
              type="number"
              value={form.SGSTRate}
              onChange={(e) => setForm({ ...form, SGSTRate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-500">
            CGST %
            <input
              type="number"
              value={form.CGSTRate}
              onChange={(e) => setForm({ ...form, CGSTRate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-orange-600 py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
      {saved && <p className="text-center text-xs font-medium text-green-600">Saved.</p>}
    </div>
  )
}
