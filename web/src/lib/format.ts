export function formatCurrency(n: number): string {
  return `₹${n.toFixed(2)}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDateOnly(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTimeOnly(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function digitsOnly(phone: string | number): string {
  return String(phone).replace(/\D/g, '')
}

// wa.me requires the full international number -- a bare 10-digit local
// number (what every phone field in this app collects) opens a chat that
// WhatsApp can't resolve ("the link couldn't be opened"). This app is
// India-only, so the 91 country code is always safe to add here rather
// than asking staff to type it every time.
export function toWhatsAppNumber(phone: string | number): string {
  const digits = digitsOnly(phone)
  return digits.length === 10 ? `91${digits}` : digits
}
