import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Bill } from '../api/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { IconSearch } from '../components/icons'

export default function History() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true)
      const results = await api.getBills(search)
      setBills(results)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  return (
    <div className="px-4 py-4">
      <div className="relative mb-4">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or bill #"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm"
        />
      </div>

      {loading && <p className="text-center text-sm text-gray-400">Loading…</p>}
      {!loading && bills.length === 0 && <p className="text-center text-sm text-gray-400">No bills found.</p>}

      <div className="flex flex-col gap-2">
        {bills.map((bill) => (
          <button
            key={bill.billNo}
            onClick={() => navigate(`/bill/${bill.billNo}`, { state: { bill } })}
            className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-left shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">#{bill.billNo} · {bill.customerName || 'Walk-in'}</p>
              <p className="text-xs text-gray-400">{formatDateTime(bill.dateTime)}</p>
            </div>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(bill.total)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
