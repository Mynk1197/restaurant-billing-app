import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Bill } from '../api/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { IconSearch } from '../components/icons'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Lives outside the component (module scope) rather than in state, so it
// survives History unmounting when you navigate to a bill and remounting
// when you come back -- React Router doesn't keep this page's state across
// that. A real page reload re-runs this module from scratch, resetting it
// back to today, which is the one case filters should actually clear.
const savedFilters = {
  search: '',
  dateFrom: todayStr(),
  dateTo: todayStr(),
}

export default function History() {
  const navigate = useNavigate()
  const [search, setSearch] = useState(savedFilters.search)
  const [dateFrom, setDateFrom] = useState(savedFilters.dateFrom)
  const [dateTo, setDateTo] = useState(savedFilters.dateTo)
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    savedFilters.search = search
    savedFilters.dateFrom = dateFrom
    savedFilters.dateTo = dateTo
  }, [search, dateFrom, dateTo])

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true)
      const results = await api.getBills(search, dateFrom, dateTo)
      setBills(results)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, dateFrom, dateTo])

  return (
    <div className="px-4 py-4">
      {/* Defaults to today so this doesn't load every bill ever created --
          widen the range to look further back, e.g. when searching for a
          customer whose last visit wasn't today. */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      <div className="relative mb-3">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or bill #"
          disabled={loading}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">
          {loading ? 'Loading…' : `${bills.length} bill${bills.length === 1 ? '' : 's'}`}
        </p>
        {!loading && bills.length > 0 && (
          <p className="text-xs font-bold text-gray-800">
            Total: {formatCurrency(bills.reduce((sum, b) => sum + b.total, 0))}
          </p>
        )}
      </div>

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
