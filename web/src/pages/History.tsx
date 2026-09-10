import { useEffect, useState } from 'react'
import { useNavigate, useNavigationType } from 'react-router-dom'
import { api, type Bill } from '../api/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { IconSearch } from '../components/icons'
import Banner from '../components/Banner'

const MAX_RANGE_DAYS = 7

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / msPerDay)
}

// Lives outside the component (module scope) rather than in state, so it can
// survive History unmounting when you navigate to a bill and remounting
// when you come back -- React Router doesn't keep this page's state across
// that on its own.
const savedFilters = {
  search: '',
  dateFrom: todayStr(),
  dateTo: todayStr(),
  showVoided: false,
}

export default function History() {
  const navigate = useNavigate()
  // useNavigationType tells us HOW this mount was reached: 'POP' is a
  // browser-back (e.g. the bill page's Back button, via navigate(-1)) --
  // that's the "coming back from viewing a bill" case filters should
  // survive. Anything else (a fresh 'PUSH', like tapping the History tab
  // in BottomNav from a different section) starts over at today, same as
  // an actual page reload.
  const navigationType = useNavigationType()
  const isReturningToPage = navigationType === 'POP'
  const [search, setSearch] = useState(isReturningToPage ? savedFilters.search : '')
  const [dateFrom, setDateFrom] = useState(isReturningToPage ? savedFilters.dateFrom : todayStr())
  const [dateTo, setDateTo] = useState(isReturningToPage ? savedFilters.dateTo : todayStr())
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [showVoided, setShowVoided] = useState(isReturningToPage ? savedFilters.showVoided : false)

  const rangeDays = daysBetween(dateFrom, dateTo)
  const rangeError =
    rangeDays < 0
      ? "'From' date must be before 'To' date."
      : rangeDays > MAX_RANGE_DAYS - 1
        ? `Date range can't be more than ${MAX_RANGE_DAYS} days.`
        : null

  useEffect(() => {
    savedFilters.search = search
    savedFilters.dateFrom = dateFrom
    savedFilters.dateTo = dateTo
    savedFilters.showVoided = showVoided
  }, [search, dateFrom, dateTo, showVoided])

  useEffect(() => {
    if (rangeError) {
      setBills([])
      setLoading(false)
      return
    }
    const timeout = setTimeout(async () => {
      setLoading(true)
      const results = await api.getBills(search, dateFrom, dateTo, showVoided)
      setBills(results)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, dateFrom, dateTo, rangeError, showVoided])

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
      {rangeError && (
        <div className="mb-3">
          <Banner tone="error">{rangeError}</Banner>
        </div>
      )}

      <div className="relative mb-3">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or bill #"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-800"
        />
      </div>

      <label className="mb-3 flex items-center gap-2 text-xs font-medium text-gray-500">
        <input
          type="checkbox"
          checked={showVoided}
          onChange={(e) => setShowVoided(e.target.checked)}
          disabled={loading}
        />
        Include voided bills
      </label>

      {!rangeError && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500">
            {loading ? 'Loading…' : `${bills.length} bill${bills.length === 1 ? '' : 's'}`}
          </p>
          {!loading && bills.length > 0 && (
            <p className="text-xs font-bold text-gray-800">
              Total: {formatCurrency(bills.filter((b) => b.status !== 'Voided').reduce((sum, b) => sum + b.total, 0))}
            </p>
          )}
        </div>
      )}

      {!loading && !rangeError && bills.length === 0 && <p className="text-center text-sm text-gray-400">No bills found.</p>}

      <div className="flex flex-col gap-2">
        {bills.map((bill) => (
          <button
            key={bill.billNo}
            onClick={() => navigate(`/bill/${bill.billNo}`, { state: { bill } })}
            disabled={loading}
            className={`flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-left shadow-sm disabled:opacity-50 ${
              bill.status === 'Voided' ? 'opacity-60' : ''
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">
                #{bill.billNo} · {bill.customerName || 'Walk-in'}
                {bill.tableNumber && <span className="text-gray-400"> · Table {bill.tableNumber}</span>}
                {bill.status === 'Voided' && (
                  <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">VOIDED</span>
                )}
              </p>
              <p className="text-xs text-gray-400">{formatDateTime(bill.dateTime)}</p>
            </div>
            <p className={`text-sm font-bold ${bill.status === 'Voided' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {formatCurrency(bill.total)}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
