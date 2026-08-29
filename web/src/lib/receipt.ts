import jsPDF from 'jspdf'
import type { Bill } from '../api/api'
import { formatCurrency, formatDateTime, digitsOnly } from './format'

export function buildReceiptPdf(bill: Bill): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: [280, 400 + bill.items.length * 16] })
  const width = doc.internal.pageSize.getWidth()
  const center = width / 2
  let y = 24

  // Settings/bill fields that look numeric (e.g. a phone number typed as
  // digits) come back from Google Sheets as actual JS numbers, not strings —
  // jsPDF's text() throws if given anything but a string, so every value it
  // renders is coerced here rather than trusted to already be a string.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(String(bill.restaurantName || 'Restaurant'), center, y, { align: 'center' })
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  if (bill.address) {
    doc.text(String(bill.address), center, y, { align: 'center' })
    y += 11
  }
  if (bill.phone) {
    doc.text(String(bill.phone), center, y, { align: 'center' })
    y += 11
  }

  y += 4
  doc.setLineDashPattern([1, 1], 0)
  doc.line(16, y, width - 16, y)
  y += 14

  doc.setFontSize(8.5)
  doc.text(`Bill #${bill.billNo}`, 16, y)
  doc.text(formatDateTime(bill.dateTime), width - 16, y, { align: 'right' })
  y += 12
  if (bill.customerName) {
    doc.text(`Customer: ${String(bill.customerName)}`, 16, y)
    y += 12
  }
  y += 4
  doc.line(16, y, width - 16, y)
  y += 14

  doc.setFont('helvetica', 'bold')
  doc.text('Item', 16, y)
  doc.text('Qty', width - 110, y, { align: 'right' })
  doc.text('Amount', width - 16, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 12

  bill.items.forEach((item) => {
    doc.text(String(item.name), 16, y, { maxWidth: width - 140 })
    doc.text(String(item.qty), width - 110, y, { align: 'right' })
    doc.text(formatCurrency(item.lineTotal), width - 16, y, { align: 'right' })
    y += 14
  })

  y += 2
  doc.line(16, y, width - 16, y)
  y += 14

  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(label, 16, y)
    doc.text(value, width - 16, y, { align: 'right' })
    y += 13
  }
  row('Subtotal', formatCurrency(bill.subtotal))
  if (bill.discount > 0) row('Discount', `-${formatCurrency(bill.discount)}`)
  row('SGST', formatCurrency(bill.sgst))
  row('CGST', formatCurrency(bill.cgst))
  y += 2
  doc.line(16, y, width - 16, y)
  y += 14
  row('Total', formatCurrency(bill.total), true)
  row('Payment', String(bill.paymentMethod))

  y += 10
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text('Thank you, visit again!', center, y, { align: 'center' })

  return doc
}

export function receiptFileName(bill: Bill): string {
  return `Bill-${bill.billNo}.pdf`
}

export function whatsAppMessage(bill: Bill): string {
  return `Hi ${bill.customerName || ''}, here's your bill #${bill.billNo} from ${bill.restaurantName} for ${formatCurrency(bill.total)}. Thank you!`
}

// Neither the Web Share API nor a wa.me link can both target a specific
// contact AND attach a file -- that combination only exists behind
// WhatsApp's paid Business API. So instead of the OS share sheet (which
// hands off to WhatsApp's own contact picker, losing the number the
// customer typed in), this opens the customer's exact chat directly via
// wa.me and downloads the PDF alongside it for staff to attach manually
// with one tap inside that already-open chat.
export function sendBillToWhatsApp(bill: Bill) {
  // Navigating the current tab (location.href) at the same instant as
  // triggering a file download makes some mobile browsers drop one of the
  // two actions -- opening WhatsApp in a new tab instead keeps the app's
  // own tab in place for the download and doesn't get popup-blocked here
  // since it's still a direct, synchronous result of the tap.
  const phone = digitsOnly(bill.customerPhone)
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsAppMessage(bill))}`
  window.open(url, '_blank', 'noopener')
  downloadBillPdf(bill)
}

export function downloadBillPdf(bill: Bill) {
  const doc = buildReceiptPdf(bill)
  doc.save(receiptFileName(bill))
}
