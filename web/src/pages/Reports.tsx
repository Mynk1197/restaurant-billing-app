import { useEffect, useState } from 'react'
import { api, type Reports as ReportsData } from '../api/api'
import { formatCurrency } from '../lib/format'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getReports(dateFrom, dateTo).then((res) => {
      setData(res)
      setLoading(false)
    })
  }, [dateFrom, dateTo])

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {loading && <p className="text-center text-sm text-gray-400">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
              <p className="text-lg font-extrabold text-gray-800">{formatCurrency(data.totalSales)}</p>
              <p className="text-[11px] text-gray-400">Total Sales</p>
            </div>
            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
              <p className="text-lg font-extrabold text-gray-800">{data.billCount}</p>
              <p className="text-[11px] text-gray-400">Bills</p>
            </div>
            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
              <p className="text-lg font-extrabold text-gray-800">{formatCurrency(data.gstCollected)}</p>
              <p className="text-[11px] text-gray-400">GST Collected</p>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Payment Method</h2>
            {Object.entries(data.byPaymentMethod).length === 0 && <p className="text-xs text-gray-400">No sales in range.</p>}
            {Object.entries(data.byPaymentMethod).map(([method, amount]) => (
              <div key={method} className="flex justify-between py-1 text-sm text-gray-600">
                <span>{method}</span>
                <span className="font-semibold">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Item-wise Sales</h2>
            {data.byItem.length === 0 && <p className="text-xs text-gray-400">No sales in range.</p>}
            {data.byItem.map((item) => (
              <div key={item.name} className="flex justify-between py-1 text-sm text-gray-600">
                <span>{item.name} × {item.qty}</span>
                <span className="font-semibold">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
