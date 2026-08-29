import jsPDF from 'jspdf'
import type { Bill } from '../api/api'
import { formatCurrency, formatDateOnly, formatTimeOnly, digitsOnly } from './format'
import { NOTO_SANS_REGULAR_BASE64, NOTO_SANS_BOLD_BASE64 } from './receiptFont'

// jsPDF's built-in fonts (Helvetica etc.) don't include the ₹ glyph, so
// doc.text() rendered it as a broken box. Noto Sans does have it -- it's
// registered per-document here (jsPDF fonts live on the document instance,
// not globally) and used everywhere instead of Helvetica so the real ₹
// symbol prints correctly, matching what the on-screen app already shows.
function registerReceiptFont(doc: jsPDF) {
  doc.addFileToVFS('NotoSans-Regular.ttf', NOTO_SANS_REGULAR_BASE64)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.addFileToVFS('NotoSans-Bold.ttf', NOTO_SANS_BOLD_BASE64)
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')
}

// Groups by category in first-seen order, keeping items within a category
// in the order they were added to the bill.
function groupByCategory(items: Bill['items']): { category: string; items: Bill['items'] }[] {
  const order: string[] = []
  const groups = new Map<string, Bill['items']>()
  items.forEach((item) => {
    const key = item.category || 'Other'
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(item)
  })
  return order.map((category) => ({ category, items: groups.get(category)! }))
}

export function buildReceiptPdf(bill: Bill): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: [300, 460 + bill.items.length * 16] })
  registerReceiptFont(doc)
  const width = doc.internal.pageSize.getWidth()
  const center = width / 2
  const margin = 16
  const colQty = width - 150
  const colPrice = width - 96
  const colSub = width - margin
  let y = 24

  // Settings/bill fields that look numeric (e.g. a phone number typed as
  // digits) come back from Google Sheets as actual JS numbers, not strings —
  // jsPDF's text() throws if given anything but a string, so every value it
  // renders is coerced here rather than trusted to already be a string.
  doc.setFont('NotoSans', 'bold')
  doc.setFontSize(14)
  doc.text('WELCOME!!!', center, y, { align: 'center' })
  y += 16

  doc.setFontSize(12)
  doc.text(String(bill.restaurantName || 'Restaurant'), center, y, { align: 'center' })
  y += 14

  doc.setFont('NotoSans', 'normal')
  doc.setFontSize(8)
  if (bill.address) {
    doc.text(String(bill.address), center, y, { align: 'center', maxWidth: width - margin * 2 })
    y += 11
  }
  if (bill.phone) {
    doc.text(String(bill.phone), center, y, { align: 'center' })
    y += 11
  }

  y += 4
  doc.line(margin, y, width - margin, y)
  y += 14

  doc.setFont('NotoSans', 'bold')
  doc.setFontSize(9)
  doc.text('Original Receipt', center, y, { align: 'center' })
  y += 14
  doc.line(margin, y - 8, width - margin, y - 8)

  doc.setFont('NotoSans', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Date : ${formatDateOnly(bill.dateTime)}`, margin, y)
  doc.text(`Time : ${formatTimeOnly(bill.dateTime)}`, width - margin, y, { align: 'right' })
  y += 12
  if (bill.customerName) {
    doc.text(String(bill.customerName), margin, y)
    y += 12
  }
  doc.text(`Receipt No.: ${bill.billNo}`, margin, y)
  y += 12

  y += 2
  doc.line(margin, y, width - margin, y)
  y += 14

  doc.setFont('NotoSans', 'bold')
  doc.setFontSize(8)
  doc.text('Description', margin, y)
  doc.text('Qty', colQty, y, { align: 'right' })
  doc.text('Price', colPrice, y, { align: 'right' })
  doc.text('Subtotal', colSub, y, { align: 'right' })
  y += 12

  groupByCategory(bill.items).forEach(({ category, items }) => {
    doc.setFont('NotoSans', 'bold')
    doc.setFontSize(8.5)
    doc.text(category.toUpperCase(), margin, y)
    y += 13

    doc.setFont('NotoSans', 'normal')
    doc.setFontSize(8)
    items.forEach((item) => {
      doc.text(String(item.name), margin, y, { maxWidth: colQty - margin - 6 })
      doc.text(String(item.qty), colQty, y, { align: 'right' })
      doc.text(formatCurrency(item.price), colPrice, y, { align: 'right' })
      doc.text(formatCurrency(item.lineTotal), colSub, y, { align: 'right' })
      y += 13
    })
  })

  y += 2
  doc.line(margin, y, width - margin, y)
  y += 14

  const row = (label: string, value: string, bold = false) => {
    doc.setFont('NotoSans', bold ? 'bold' : 'normal')
    doc.text(label, margin, y)
    doc.text(value, width - margin, y, { align: 'right' })
    y += 13
  }
  row('Sub Total :', formatCurrency(bill.subtotal))
  if (bill.discount > 0) row('Discount :', `-${formatCurrency(bill.discount)}`)
  row(`CGST : ${bill.cgstRate ?? ''}%`.replace(' : %', ' :'), formatCurrency(bill.cgst))
  row(`SGST : ${bill.sgstRate ?? ''}%`.replace(' : %', ' :'), formatCurrency(bill.sgst))
  y += 2
  doc.line(margin, y, width - margin, y)
  y += 14
  row('Total :', formatCurrency(bill.total), true)
  y += 4
  row('Mode :', String(bill.paymentMethod))

  y += 8
  doc.line(margin, y, width - margin, y)
  y += 14
  doc.setFont('NotoSans', 'normal')
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
