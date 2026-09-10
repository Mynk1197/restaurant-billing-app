import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { db } from '../db/db'
import { notifyQueueChanged } from '../db/sync'
import { useDishesAndSettings } from '../hooks/useDishesAndSettings'
import { formatCurrency } from '../lib/format'
import Banner from '../components/Banner'
import DishGrid from '../components/DishGrid'

const PAYMENT_METHODS = ['Cash', 'Card', 'UPI']

export default function Billing() {
  const navigate = useNavigate()
  const { dishes, settings, loading } = useDishesAndSettings()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discount, setDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)

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

  function adjustQty(dishId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max((prev[dishId] ?? 0) + delta, 0)
      return { ...prev, [dishId]: next }
    })
  }

  async function handleCreateBill() {
    if (!lineItems.length) {
      setError('Add at least one dish to the bill.')
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
    setSubmitting(true)
    setError(null)
    const payload = { customerName, customerPhone, items: lineItems, discount: discountNum, paymentMethod }
    try {
      const bill = await api.createBill(payload)
      resetCart()
      navigate(`/bill/${bill.billNo}`, { state: { bill, returnTo: '/' } })
    } catch (err) {
      if (!navigator.onLine) {
        await db.billQueue.add({ ...payload, createdAt: new Date().toISOString() })
        notifyQueueChanged()
        resetCart()
        setShowCheckout(false)
        setError('Offline: bill saved locally and will sync automatically once you\'re back online.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create bill')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function resetCart() {
    setCart({})
    setCustomerName('')
    setCustomerPhone('')
    setDiscount('')
    setPaymentMethod('Cash')
  }

  const itemCount = lineItems.reduce((sum, it) => sum + it.qty, 0)

  return (
    <div className={`flex flex-col gap-4 px-4 py-4 ${lineItems.length > 0 ? 'pb-24' : ''}`}>
      {error && !showCheckout && <Banner tone="error">{error}</Banner>}

      <DishGrid
        dishes={dishes}
        cart={cart}
        onAdjustQty={adjustQty}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      {/* Always pinned just above BottomNav, regardless of how tall the dish
          list is -- position:sticky on this same element only "stuck" once
          scrolled that far, so with a short list it just floated wherever
          it naturally landed instead of staying anchored to the bottom. */}
      {lineItems.length > 0 && !showCheckout && (
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4">
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
            <span>Review & Create Bill · {formatCurrency(total)}</span>
          </button>
        </div>
      )}

      {showCheckout && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40"
          onClick={() => {
            if (submitting) return
            setError(null)
            setShowCheckout(false)
          }}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Review Bill</h3>
              <button
                onClick={() => {
                  if (submitting) return
                  resetCart()
                  setError(null)
                  setShowCheckout(false)
                }}
                disabled={submitting}
                className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 disabled:opacity-40"
              >
                Discard Bill
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
                  disabled={submitting}
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
                  disabled={submitting}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </label>
            </div>

            <div className="mb-3 flex gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  disabled={submitting}
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
                disabled={submitting}
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
                onClick={() => {
                  setError(null)
                  setShowCheckout(false)
                }}
                disabled={submitting}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={handleCreateBill}
                disabled={submitting || !lineItems.length}
                className="flex-[2] rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {submitting ? 'Creating…' : `Create Bill · ${formatCurrency(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
