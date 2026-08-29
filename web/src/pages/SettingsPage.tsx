import { useEffect, useState } from 'react'
import { api, type Settings } from '../api/api'

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getSettings().then(setForm)
  }, [])

  function update(fields: Partial<Settings>) {
    setForm((prev) => (prev ? { ...prev, ...fields } : prev))
    setSaved(false)
    setError(null)
  }

  async function handleSave() {
    if (!form) return
    if (!form.RestaurantName.trim() || !form.Address.trim() || !form.Phone.trim()) {
      setError('Restaurant name, address, and phone are all required.')
      return
    }
    if (form.Phone.length !== 10) {
      setError('Phone number must be exactly 10 digits.')
      return
    }
    if (form.SGSTRate.trim() === '' || form.CGSTRate.trim() === '') {
      setError('SGST and CGST rates are required (0 is fine, but they can’t be blank).')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await api.saveSettings(form)
      setForm(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <p className="px-4 py-8 text-center text-sm text-gray-400">Loading…</p>

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {saved && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
          ✓ Settings saved — your changes are live for the next bill.
        </p>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{error}</p>}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Restaurant details</h2>
        <div className="flex flex-col gap-2">
          <input
            value={form.RestaurantName}
            onChange={(e) => update({ RestaurantName: e.target.value })}
            placeholder="Restaurant name"
            disabled={saving}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          />
          <input
            value={form.Address}
            onChange={(e) => update({ Address: e.target.value })}
            placeholder="Address"
            disabled={saving}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          />
          <input
            value={form.Phone}
            onChange={(e) => update({ Phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            placeholder="Phone (10 digits)"
            inputMode="numeric"
            maxLength={10}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
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
              onChange={(e) => update({ SGSTRate: e.target.value })}
              disabled={saving}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
          </label>
          <label className="text-xs text-gray-500">
            CGST %
            <input
              type="number"
              value={form.CGSTRate}
              onChange={(e) => update({ CGSTRate: e.target.value })}
              disabled={saving}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
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
    </div>
  )
}
