import jsPDF from 'jspdf'
import type { Bill } from '../api/api'
import { formatCurrency, formatDateTime, digitsOnly } from './format'

// jsPDF's built-in fonts (Helvetica etc.) don't include the ₹ glyph, so
// doc.text() renders it as a broken box -- "Rs." is used here instead,
// specifically for the PDF. The on-screen app keeps the real ₹ symbol
// (formatCurrency in format.ts), since browsers render that fine.
function money(n: number): string {
  return `Rs. ${n.toFixed(2)}`
}

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
    doc.text(money(item.lineTotal), width - 16, y, { align: 'right' })
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
  row('Subtotal', money(bill.subtotal))
  if (bill.discount > 0) row('Discount', `-${money(bill.discount)}`)
  row('SGST', money(bill.sgst))
  row('CGST', money(bill.cgst))
  y += 2
  doc.line(16, y, width - 16, y)
  y += 14
  row('Total', money(bill.total), true)
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
// customer typed in), the flow is two explicit, separately-tapped steps:
// download the PDF, then open the customer's exact chat via wa.me for
// staff to attach it manually. Chaining these automatically doesn't work
// on iOS -- opening a new tab steals focus immediately, and there's no
// JS event for "the user finished the save prompt" to wait for -- so the
// second step only happens on its own explicit tap.
// Tracks the WhatsApp tab this app itself opened, so a repeat tap (e.g.
// switching to a different bill) can close the previous one first instead
// of letting them pile up. Only ever refers to a tab this code opened --
// 'noopener' isn't used here specifically so this reference is available.
let lastWhatsAppTab: Window | null = null

export function openWhatsAppChat(bill: Bill) {
  if (lastWhatsAppTab && !lastWhatsAppTab.closed) {
    lastWhatsAppTab.close()
  }
  const phone = digitsOnly(bill.customerPhone)
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsAppMessage(bill))}`
  lastWhatsAppTab = window.open(url, '_blank')
}

export function downloadBillPdf(bill: Bill) {
  const doc = buildReceiptPdf(bill)
  doc.save(receiptFileName(bill))
}
