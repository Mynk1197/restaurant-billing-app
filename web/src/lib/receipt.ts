import jsPDF from 'jspdf'
import type { Bill } from '../api/api'
import { formatCurrency, formatDateTime, digitsOnly } from './format'

export function buildReceiptPdf(bill: Bill): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: [280, 400 + bill.items.length * 16] })
  const width = doc.internal.pageSize.getWidth()
  const center = width / 2
  let y = 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(bill.restaurantName || 'Restaurant', center, y, { align: 'center' })
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  if (bill.address) {
    doc.text(bill.address, center, y, { align: 'center' })
    y += 11
  }
  if (bill.phone) {
    doc.text(bill.phone, center, y, { align: 'center' })
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
    doc.text(`Customer: ${bill.customerName}`, 16, y)
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
    doc.text(item.name, 16, y, { maxWidth: width - 140 })
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
  row('Payment', bill.paymentMethod)

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

export async function shareBillOnWhatsApp(bill: Bill): Promise<'shared' | 'fallback'> {
  const doc = buildReceiptPdf(bill)
  const blob = doc.output('blob')
  const file = new File([blob], receiptFileName(bill), { type: 'application/pdf' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: whatsAppMessage(bill) })
      return 'shared'
    } catch {
      // user cancelled the share sheet or it failed — fall through to wa.me
    }
  }

  const phone = digitsOnly(bill.customerPhone)
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsAppMessage(bill))}`
  window.open(url, '_blank')
  return 'fallback'
}

export function downloadBillPdf(bill: Bill) {
  const doc = buildReceiptPdf(bill)
  doc.save(receiptFileName(bill))
}
