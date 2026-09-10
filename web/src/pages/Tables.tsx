import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Order } from '../api/api'
import { formatCurrency } from '../lib/format'

export default function Tables() {
  const navigate = useNavigate()
  const [tableCount, setTableCount] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [settings, openOrders] = await Promise.all([api.getSettings(), api.getOpenOrders()])
    setTableCount(Number(settings.TableCount) || 0)
    setOrders(openOrders)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const orderByTable = new Map(orders.map((o) => [o.tableNumber, o]))
  const tableNumbers = Array.from({ length: tableCount }, (_, i) => String(i + 1))

  return (
    <div className="px-4 py-4">
      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
        </div>
      )}

      {!loading && tableCount === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          No tables configured yet. Set "Number of tables" in GST Settings.
        </p>
      )}

      {!loading && tableCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {tableNumbers.map((tableNumber) => {
            const order = orderByTable.get(tableNumber)
            const occupied = !!order
            const total = order ? order.items.reduce((sum, it) => sum + it.lineTotal, 0) : 0
            return (
              <button
                key={tableNumber}
                onClick={() => navigate(`/tables/${tableNumber}`)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-5 shadow-sm ${
                  occupied ? 'bg-orange-600 text-white' : 'bg-white text-gray-800'
                }`}
              >
                <span className="text-lg font-extrabold">Table {tableNumber}</span>
                <span className={`text-[11px] font-semibold ${occupied ? 'text-orange-100' : 'text-gray-400'}`}>
                  {occupied ? 'Occupied' : 'Free'}
                </span>
                {occupied && <span className="text-xs font-bold">{formatCurrency(total)}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
