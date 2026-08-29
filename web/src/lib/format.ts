export function formatCurrency(n: number): string {
  return `₹${n.toFixed(2)}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}
