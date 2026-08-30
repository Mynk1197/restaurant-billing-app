import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, type Bill } from '../api/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { openWhatsAppChat, downloadBillPdf } from '../lib/receipt'
import { IconWhatsApp, IconDownload, IconCheck } from '../components/icons'
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

  if (loading) return <p className="px-4 py-8 text-center text-sm text-gray-400">Loading bill…</p>
  if (!bill) return <p className="px-4 py-8 text-center text-sm text-gray-400">Bill not found.</p>

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
          onClick={() => navigate('/')}
          className="mt-6 w-full max-w-xs rounded-xl bg-orange-600 py-3 text-sm font-bold text-white"
        >
          Close · Back to Billing
        </button>
        <button onClick={() => setChatOpened(false)} className="mt-3 text-xs font-medium text-gray-400">
          View receipt again
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
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

      {/* Sending on WhatsApp is optional -- a customer who doesn't want to
          share their number still needs a way to finish the bill. */}
      <button
        onClick={() => navigate('/')}
        className="mt-4 w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-600"
      >
        Skip WhatsApp · Done, back to Billing
      </button>
    </div>
  )
}
