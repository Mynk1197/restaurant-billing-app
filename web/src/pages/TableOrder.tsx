import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/api'
import { useDishesAndSettings } from '../hooks/useDishesAndSettings'
import { formatCurrency } from '../lib/format'
import { IconArrowLeft } from '../components/icons'
import Banner from '../components/Banner'
import DishGrid from '../components/DishGrid'

const PAYMENT_METHODS = ['Cash', 'Card', 'UPI']
const AUTOSAVE_DELAY_MS = 1200

export default function TableOrder() {
  const { tableNumber } = useParams()
  const navigate = useNavigate()
  const { dishes, settings, loading } = useDishesAndSettings()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discount, setDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [orderId, setOrderId] = useState<string | undefined>(undefined)
  const [showCheckout, setShowCheckout] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingLabel, setSavingLabel] = useState<'idle' | 'saving' | 'saved'>('idle')
  // Guards against tapping Back multiple times while the flush save is
  // still in flight -- without this, each tap awaits its own
  // flushPendingSave() and then calls navigate(-1), so several navigate(-1)
  // calls end up queued and fire one after another once each resolves,
  // walking back through history further than the single tap intended.
  const leavingRef = useRef(false)

  // A table's draft order is server-side session state, not something a
  // stale local cache could ever stand in for -- always fetched fresh, and
  // kept independent of the dishes/settings loading state above so the
  // dish grid (which can render straight from cache) doesn't wait on this.
  // orderRestored gates the autosave effect below so restoring an existing
  // order's fields doesn't immediately re-save that same data back to
  // itself as if it were a fresh edit.
  const [orderRestored, setOrderRestored] = useState(false)

  useEffect(() => {
    if (!tableNumber) return
    ;(async () => {
      const existing = await api.getOrder({ tableNumber })
      if (existing) {
        setOrderId(existing.orderId)
        setCustomerName(existing.customerName)
        setCustomerPhone(existing.customerPhone ? String(existing.customerPhone) : '')
        setPaymentMethod(existing.paymentMethod || 'Cash')
        setDiscount(existing.discount ? String(existing.discount) : '')
        const restoredCart: Record<string, number> = {}
        existing.items.forEach((it) => {
          restoredCart[it.dishId] = it.qty
        })
        setCart(restoredCart)
      }
      setOrderRestored(true)
    })()
  }, [tableNumber])

  const lineItems = useMemo(
    () =>
      dishes
        .filter((d) => cart[d.Id] > 0)
        .map((d) => ({ dishId: d.Id, name: d.Name, category: d.Category, price: Number(d.Price), qty: cart[d.Id] })),
    [dishes, cart],
  )

  const discountNum = Number(discount) || 0
  const subtotal = lineItems.reduce((sum, it) => sum + it.price * it.qty, 0)
  const sgstRate = Number(settings?.SGSTRate ?? 0)
  const cgstRate = Number(settings?.CGSTRate ?? 0)
  const taxable = Math.max(subtotal - discountNum, 0)
  const sgst = Math.round(((taxable * sgstRate) / 100) * 100) / 100
  const cgst = Math.round(((taxable * cgstRate) / 100) * 100) / 100
  const total = Math.round((taxable + sgst + cgst) * 100) / 100
  const itemCount = lineItems.reduce((sum, it) => sum + it.qty, 0)

  function adjustQty(dishId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max((prev[dishId] ?? 0) + delta, 0)
      return { ...prev, [dishId]: next }
    })
  }

  // Auto-saves the draft as it changes, so another device sees a table's
  // current order and nothing is lost if staff navigate away mid-edit --
  // debounced so every single tap doesn't fire its own request. Only saves
  // once there's at least one item (or an order already exists), so just
  // opening a free table's screen doesn't create an empty ghost order.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestPayloadRef = useRef<null | (() => Promise<void>)>(null)

  useEffect(() => {
    if (loading || !orderRestored || !tableNumber) return
    if (!lineItems.length && !orderId) return

    const doSave = async () => {
      setSavingLabel('saving')
      try {
        const result = await api.saveOrder({
          orderId,
          tableNumber,
          customerName,
          customerPhone,
          paymentMethod,
          discount: discountNum,
          items: lineItems,
        })
        setOrderId(result.orderId)
        setSavingLabel('saved')
      } catch {
        setSavingLabel('idle')
      }
    }
    latestPayloadRef.current = doSave

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(doSave, AUTOSAVE_DELAY_MS)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, customerName, customerPhone, paymentMethod, discount, loading, orderRestored])

  async function flushPendingSave() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    if (latestPayloadRef.current) await latestPayloadRef.current()
  }

  async function handleFinalize() {
    if (!lineItems.length) {
      setError('Add at least one dish before finalizing.')
      return
    }
    if (!customerName.trim()) {
      setError('Customer name is required.')
      return
    }
    if (customerPhone && customerPhone.length !== 10) {
      setError('WhatsApp number must be exactly 10 digits.')
      return
    }
    setFinalizing(true)
    setError(null)
    try {
      await flushPendingSave()
      if (!orderId) throw new Error('Order not saved yet, try again.')
      const bill = await api.finalizeOrder(orderId)
      navigate(`/bill/${bill.billNo}`, { state: { bill, returnTo: '/tables' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize bill.')
    } finally {
      setFinalizing(false)
    }
  }

  async function handleCancelOrder() {
    setCancelling(true)
    setError(null)
    // Stop the debounced autosave from firing after this and re-creating
    // the very order row cancelOrder is about to delete.
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    try {
      if (orderId) await api.cancelOrder(orderId)
      navigate('/tables')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className={`flex flex-col gap-4 px-4 py-4 ${lineItems.length > 0 ? 'pb-24' : ''}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={async () => {
            if (leavingRef.current) return
            leavingRef.current = true
            await flushPendingSave()
            navigate(-1)
          }}
          className="flex items-center gap-1 text-sm font-medium text-gray-500"
        >
          <IconArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">Table {tableNumber}</span>
          {savingLabel === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
          {savingLabel === 'saved' && <span className="text-xs text-green-600">Saved</span>}
        </div>
      </div>

      {error && !showCheckout && <Banner tone="error">{error}</Banner>}

      {/* Gated on orderRestored too, not just dishes/settings loading --
          otherwise the grid was interactive before the existing order's
          items arrived, and a tap made in that window got silently
          overwritten once restore's setCart() replaced the whole cart. */}
      <DishGrid
        dishes={dishes}
        cart={cart}
        onAdjustQty={adjustQty}
        loading={loading || !orderRestored}
        search={search}
        onSearchChange={setSearch}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      {lineItems.length > 0 && !showCheckout && (
        <div
          className="fixed inset-x-0 z-10 mx-auto max-w-md px-4"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => {
              setError(null)
              setShowCheckout(true)
            }}
            className="flex w-full items-center justify-between rounded-2xl bg-orange-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg"
          >
            <span>
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
            <span>Review & Finalize · {formatCurrency(total)}</span>
          </button>
        </div>
      )}

      {orderId && lineItems.length === 0 && !showCheckout && (
        <button
          onClick={handleCancelOrder}
          disabled={cancelling}
          className="rounded-xl border border-rose-200 bg-white py-2.5 text-sm font-semibold text-rose-600 disabled:opacity-40"
        >
          {cancelling ? 'Cancelling…' : 'Cancel Order & Free Table'}
        </button>
      )}

      {showCheckout && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40"
          onClick={() => {
            if (finalizing) return
            setError(null)
            setShowCheckout(false)
          }}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Finalize Table {tableNumber}</h3>
              <button
                onClick={handleCancelOrder}
                disabled={finalizing || cancelling}
                className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 disabled:opacity-40"
              >
                {cancelling ? 'Discarding…' : 'Discard Order'}
              </button>
            </div>
            {error && (
              <div className="mb-3">
                <Banner tone="error">{error}</Banner>
              </div>
            )}

            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500">
                Customer name <span className="text-rose-500">*</span>
                <input
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value)
                    setError(null)
                  }}
                  disabled={finalizing}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </label>
              <label className="text-xs text-gray-500">
                WhatsApp number
                <input
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                    setError(null)
                  }}
                  inputMode="numeric"
                  maxLength={10}
                  disabled={finalizing}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </label>
            </div>

            <div className="mb-3 flex gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  disabled={finalizing}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                    paymentMethod === method ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <div className="mb-2 flex items-center justify-between text-xs">
              <label className="text-gray-500">Discount</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                disabled={finalizing}
                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <div className="space-y-1 border-t border-dashed border-gray-200 pt-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST ({sgstRate}%)</span>
                <span>{formatCurrency(sgst)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST ({cgstRate}%)</span>
                <span>{formatCurrency(cgst)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-800">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowCheckout(false)}
                disabled={finalizing}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizing || !lineItems.length}
                className="flex-[2] rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {finalizing ? 'Finalizing…' : `Finalize Bill · ${formatCurrency(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
