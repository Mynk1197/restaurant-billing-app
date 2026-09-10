import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, type Bill } from '../api/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { openWhatsAppChat, downloadBillPdf } from '../lib/receipt'
import { IconWhatsApp, IconDownload, IconCheck, IconArrowLeft } from '../components/icons'
import Banner from '../components/Banner'

export default function BillView() {
  const { billNo } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [bill, setBill] = useState<Bill | null>((location.state as { bill?: Bill } | null)?.bill ?? null)
  const [loading, setLoading] = useState(!bill)
  const [error, setError] = useState<string | null>(null)
  const [pdfSaved, setPdfSaved] = useState(false)
  const [chatOpened, setChatOpened] = useState(false)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  // Editable independently of the stored bill -- staff may have skipped the
  // number at checkout, or need to fix a typo, without redoing the whole
  // bill. Only affects where this WhatsApp chat opens, not the saved record.
  const [phone, setPhone] = useState(bill?.customerPhone ? String(bill.customerPhone) : '')

  useEffect(() => {
    if (bill || !billNo) return
    ;(async () => {
      const bills = await api.getBills(billNo)
      const found = bills.find((b) => String(b.billNo) === billNo)
      setBill(found ?? null)
      setPhone(found?.customerPhone ? String(found.customerPhone) : '')
      setLoading(false)
    })()
  }, [bill, billNo])

  // Whoever navigated here can say where "done" should lead (Billing after
  // a walk-in bill, Tables after finalizing a table order) via this state --
  // that context is otherwise lost, since navigate(-1) after finalizing a
  // table order would go back to that specific table's now-deleted order
  // screen instead of the Tables grid. Falls back to plain browser-back
  // (e.g. opened from History) when nothing set it.
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo
  const returnLabel = returnTo === '/' ? 'Back to Billing' : returnTo === '/tables' ? 'Back to Tables' : 'Back'
  const goBack = () => (returnTo ? navigate(returnTo) : navigate(-1))

  const backButton = (
    <button onClick={goBack} className="mb-3 flex items-center gap-1 text-sm font-medium text-gray-500">
      <IconArrowLeft className="h-4 w-4" /> {returnLabel}
    </button>
  )

  if (loading) {
    return (
      <div className="px-4 py-4">
        {backButton}
        <p className="py-8 text-center text-sm text-gray-400">Loading bill…</p>
      </div>
    )
  }
  if (!bill) {
    return (
      <div className="px-4 py-4">
        {backButton}
        <p className="py-8 text-center text-sm text-gray-400">Bill not found.</p>
      </div>
    )
  }

  function handleDownload() {
    if (!bill) return
    setError(null)
    try {
      downloadBillPdf(bill)
      setPdfSaved(true)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? `Couldn't download: ${err.message}` : "Couldn't download the PDF.")
    }
  }

  async function handleVoidConfirm() {
    if (!bill || !voidReason.trim()) return
    setVoiding(true)
    setError(null)
    try {
      const result = await api.voidBill(bill.billNo, voidReason.trim())
      setBill({ ...bill, status: 'Voided', voidReason: result.voidReason, voidedAt: result.voidedAt })
      setShowVoidModal(false)
    } catch (err) {
      setError(err instanceof Error ? `Couldn't void: ${err.message}` : "Couldn't void the bill.")
    } finally {
      setVoiding(false)
    }
  }

  function handleOpenChat() {
    if (!bill) return
    setError(null)
    try {
      openWhatsAppChat({ ...bill, customerPhone: phone })
      setChatOpened(true)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? `Couldn't open WhatsApp: ${err.message}` : "Couldn't open WhatsApp.")
    }
  }

  // Opening WhatsApp is a fire-and-forget window.open -- there's no way to
  // know whether the customer actually got the message, only that this app's
  // part of the job (opening the right chat) is done. Replacing the receipt
  // with this confirmation once that's happened, instead of just leaving the
  // same page showing when staff switch back from WhatsApp, gives them a
  // clear "done, next customer" action.
  if (chatOpened && bill) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
          <IconCheck className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-gray-800">WhatsApp opened for Bill #{bill.billNo}</h2>
        <p className="mt-1 max-w-xs text-sm text-gray-500">
          Attach the downloaded PDF in that chat and send it, if you haven't already.
        </p>
        <button
          onClick={goBack}
          className="mt-6 w-full max-w-xs rounded-xl bg-orange-600 py-3 text-sm font-bold text-white"
        >
          {returnTo ? `Close · ${returnLabel}` : 'Close'}
        </button>
        <button onClick={() => setChatOpened(false)} className="mt-3 text-xs font-medium text-gray-400">
          View receipt again
        </button>
      </div>
    )
  }

  const isVoided = bill.status === 'Voided'

  return (
    <div className="px-4 py-4">
      {backButton}

      {isVoided && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <p className="font-bold">VOIDED</p>
          <p className="mt-0.5 text-xs">Reason: {bill.voidReason}</p>
          {bill.voidedAt && <p className="text-xs text-rose-500">{formatDateTime(bill.voidedAt)}</p>}
        </div>
      )}

      <div className={`rounded-2xl bg-white p-5 shadow-sm ${isVoided ? 'opacity-60' : ''}`}>
        <div className="text-center">
          <p className="text-base font-extrabold text-gray-800">{bill.restaurantName}</p>
          {bill.address && <p className="text-xs text-gray-400">{bill.address}</p>}
          {bill.phone && <p className="text-xs text-gray-400">{bill.phone}</p>}
        </div>

        <div className="my-3 flex justify-between border-t border-dashed border-gray-200 pt-3 text-xs text-gray-500">
          <span>Bill #{bill.billNo}</span>
          <span>{formatDateTime(bill.dateTime)}</span>
        </div>
        {bill.customerName && <p className="mb-2 text-xs text-gray-500">Customer: {bill.customerName}</p>}

        <div className="space-y-1.5 border-t border-dashed border-gray-200 py-3">
          {bill.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>
                {item.name} × {item.qty}
              </span>
              <span>{formatCurrency(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-dashed border-gray-200 pt-3 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(bill.subtotal)}</span>
          </div>
          {bill.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{formatCurrency(bill.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>SGST</span>
            <span>{formatCurrency(bill.sgst)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST</span>
            <span>{formatCurrency(bill.cgst)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-gray-800">
            <span>Total</span>
            <span>{formatCurrency(bill.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment</span>
            <span>{bill.paymentMethod}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Banner tone="error">{error}</Banner>
        </div>
      )}

      {!isVoided && (
        <>
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <label className="text-xs text-gray-500">
              WhatsApp number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit number"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white"
            >
              <IconDownload className="h-4 w-4" />
              {pdfSaved ? 'PDF downloaded — tap again to re-download' : '1. Download Bill PDF'}
            </button>
            <button
              onClick={handleOpenChat}
              disabled={phone.length !== 10 || !pdfSaved}
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              <IconWhatsApp className="h-4 w-4" />
              2. Open WhatsApp Chat
            </button>
          </div>
          {phone.length !== 10 && (
            <p className="mt-2 text-center text-xs text-gray-400">Enter a 10-digit WhatsApp number to enable sending.</p>
          )}
          {phone.length === 10 && !pdfSaved && (
            <p className="mt-2 text-center text-xs text-gray-400">Download the PDF first, then open the chat and attach it — WhatsApp can't auto-attach a file to a specific contact without its paid Business API.</p>
          )}
          {phone.length === 10 && pdfSaved && (
            <p className="mt-2 text-center text-xs text-gray-400">Now open the chat and attach the downloaded PDF from your Downloads.</p>
          )}

          <button
            onClick={() => {
              setVoidReason('')
              setShowVoidModal(true)
            }}
            className="mt-4 w-full rounded-xl border border-rose-200 bg-white py-2.5 text-sm font-semibold text-rose-600"
          >
            Void Bill
          </button>
        </>
      )}

      {showVoidModal && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40"
          onClick={() => !voiding && setShowVoidModal(false)}
        >
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-bold text-gray-800">Void Bill #{bill.billNo}</h3>
            <p className="mb-3 text-xs text-gray-500">
              This keeps the bill for record-keeping but excludes it from Reports and History totals. This can't be undone.
            </p>
            <label className="text-xs text-gray-500">
              Reason <span className="text-rose-500">*</span>
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                disabled={voiding}
                placeholder="e.g. wrong items, customer walked out"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowVoidModal(false)}
                disabled={voiding}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidConfirm}
                disabled={voiding || !voidReason.trim()}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {voiding ? 'Voiding…' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
