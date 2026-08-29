import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { api, type Bill } from '../api/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { openWhatsAppChat, downloadBillPdf } from '../lib/receipt'
import { IconWhatsApp, IconDownload } from '../components/icons'

export default function BillView() {
  const { billNo } = useParams()
  const location = useLocation()
  const [bill, setBill] = useState<Bill | null>((location.state as { bill?: Bill } | null)?.bill ?? null)
  const [loading, setLoading] = useState(!bill)
  const [error, setError] = useState<string | null>(null)
  const [pdfSaved, setPdfSaved] = useState(false)

  useEffect(() => {
    if (bill || !billNo) return
    ;(async () => {
      const bills = await api.getBills(billNo)
      const found = bills.find((b) => String(b.billNo) === billNo)
      setBill(found ?? null)
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
      openWhatsAppChat(bill)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? `Couldn't open WhatsApp: ${err.message}` : "Couldn't open WhatsApp.")
    }
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

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</p>}

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={handleDownload}
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-600"
        >
          <IconDownload className="h-4 w-4" />
          {pdfSaved ? 'PDF downloaded — tap again to re-download' : '1. Download Bill PDF'}
        </button>
        <button
          onClick={handleOpenChat}
          disabled={!bill.customerPhone || !pdfSaved}
          className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          <IconWhatsApp className="h-4 w-4" />
          2. Open WhatsApp Chat
        </button>
      </div>
      {!bill.customerPhone && <p className="mt-2 text-center text-xs text-gray-400">Add a WhatsApp number to enable sending.</p>}
      {bill.customerPhone && !pdfSaved && (
        <p className="mt-2 text-center text-xs text-gray-400">Download the PDF first, then open the chat and attach it — WhatsApp can't auto-attach a file to a specific contact without its paid Business API.</p>
      )}
      {bill.customerPhone && pdfSaved && (
        <p className="mt-2 text-center text-xs text-gray-400">Now open the chat and attach the downloaded PDF from your Downloads.</p>
      )}
    </div>
  )
}
