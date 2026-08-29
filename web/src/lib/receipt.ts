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

const ACCENT: [number, number, number] = [234, 88, 12] // matches the app's orange theme
const INK: [number, number, number] = [31, 41, 55]
const MUTED: [number, number, number] = [107, 114, 128]
const DIVIDER: [number, number, number] = [220, 220, 220]
const PANEL: [number, number, number] = [248, 248, 248]

export function buildReceiptPdf(bill: Bill): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: [280, 460 + bill.items.length * 16] })
  const width = doc.internal.pageSize.getWidth()
  const center = width / 2
  const margin = 18
  let y = 0

  // Settings/bill fields that look numeric (e.g. a phone number typed as
  // digits) come back from Google Sheets as actual JS numbers, not strings —
  // jsPDF's text() throws if given anything but a string, so every value it
  // renders is coerced here rather than trusted to already be a string.
  const headerHeight = bill.address || bill.phone ? 56 : 42
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, width, headerHeight, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(String(bill.restaurantName || 'Restaurant'), center, 22, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const contactLine = [bill.address, bill.phone].filter(Boolean).map(String).join('  ·  ')
  if (contactLine) doc.text(contactLine, center, 36, { align: 'center', maxWidth: width - margin * 2 })

  y = headerHeight + 18

  doc.setTextColor(...INK)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text(`Bill #${bill.billNo}`, margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(formatDateTime(bill.dateTime), width - margin, y, { align: 'right' })
  y += 13
  if (bill.customerName) {
    doc.setTextColor(...INK)
    doc.text(`Customer: ${String(bill.customerName)}`, margin, y)
    y += 13
  }

  y += 6
  doc.setDrawColor(...DIVIDER)
  doc.line(margin, y, width - margin, y)
  y += 16

  doc.setFillColor(...PANEL)
  doc.rect(margin, y - 10, width - margin * 2, 16, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  doc.text('ITEM', margin + 4, y)
  doc.text('QTY', width - 108, y, { align: 'right' })
  doc.text('AMOUNT', width - margin - 4, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  y += 18

  bill.items.forEach((item) => {
    doc.setTextColor(...INK)
    doc.text(String(item.name), margin + 4, y, { maxWidth: width - 140 })
    doc.setTextColor(...MUTED)
    doc.text(String(item.qty), width - 108, y, { align: 'right' })
    doc.setTextColor(...INK)
    doc.text(money(item.lineTotal), width - margin - 4, y, { align: 'right' })
    y += 15
  })

  y += 4
  doc.setDrawColor(...DIVIDER)
  doc.line(margin, y, width - margin, y)
  y += 16

  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 10 : 8.5)
    doc.setTextColor(bold ? INK[0] : MUTED[0], bold ? INK[1] : MUTED[1], bold ? INK[2] : MUTED[2])
    doc.text(label, margin, y)
    doc.setTextColor(...INK)
    doc.text(value, width - margin, y, { align: 'right' })
    y += bold ? 17 : 14
  }
  row('Subtotal', money(bill.subtotal))
  if (bill.discount > 0) row('Discount', `-${money(bill.discount)}`)
  row('SGST', money(bill.sgst))
  row('CGST', money(bill.cgst))
  y += 3
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(1.2)
  doc.line(margin, y, width - margin, y)
  doc.setLineWidth(0.4)
  y += 17
  row('Total', money(bill.total), true)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text('Payment', margin, y)
  doc.setTextColor(...INK)
  doc.text(String(bill.paymentMethod), width - margin, y, { align: 'right' })
  y += 22

  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(2)
  doc.line(margin, y, width - margin, y)
  doc.setLineWidth(0.4)
  y += 16

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
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
