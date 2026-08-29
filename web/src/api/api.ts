const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string

function getIdToken(): string | null {
  return localStorage.getItem('idToken')
}

// Google ID tokens expire ~1 hour after being issued, and the backend
// re-verifies the token on every call -- these are the errors it returns
// once that happens (or if the account was removed from the Staff sheet
// mid-session). Distinct from business errors, which should surface as-is.
function isAuthError(message: string): boolean {
  return (
    message.includes('Invalid Google token') ||
    message.includes('Missing idToken') ||
    message.includes('Not authorized') ||
    message.includes('Email not verified')
  )
}

function forceReauth() {
  localStorage.removeItem('idToken')
  localStorage.removeItem('staff')
  window.location.reload()
}

async function call<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const idToken = getIdToken()
  if (!idToken) throw new Error('Not signed in')
  // Apps Script web app responses are served via a redirect to a
  // googleusercontent.com echo URL that only accepts GET; browsers
  // silently downgrade POST to GET (dropping the body) on that redirect,
  // so every call here uses GET with query params instead of a POST body.
  const query = new URLSearchParams({ action, idToken, ...params })
  const res = await fetch(`${APPS_SCRIPT_URL}?${query.toString()}`)
  const json = await res.json()
  if (!json.ok) {
    const message = json.error || 'Request failed'
    if (action !== 'login' && isAuthError(message)) {
      forceReauth()
    }
    throw new Error(message)
  }
  return json.data as T
}

export interface Staff {
  name: string
  email: string
}

export interface Dish {
  Id: string
  Name: string
  Category: string
  Price: number
  Active: 'Y' | 'N'
}

export interface Settings {
  RestaurantName: string
  Address: string
  Phone: string
  SGSTRate: string
  CGSTRate: string
  NextBillNumber: string
}

export interface BillLineItem {
  dishId: string
  name: string
  price: number
  qty: number
  lineTotal: number
}

export interface Bill {
  billNo: number
  dateTime: string
  customerName: string
  customerPhone: string
  items: BillLineItem[]
  subtotal: number
  discount: number
  sgst: number
  cgst: number
  total: number
  paymentMethod: string
  restaurantName: string
  address: string
  phone: string
  sgstRate?: number
  cgstRate?: number
}

export interface Reports {
  totalSales: number
  billCount: number
  gstCollected: number
  byPaymentMethod: Record<string, number>
  byItem: { name: string; qty: number; amount: number }[]
}

export const api = {
  login: (idToken: string) => {
    localStorage.setItem('idToken', idToken)
    return call<Staff>('login')
  },
  getDishes: (activeOnly = false) => call<Dish[]>('getDishes', { activeOnly: String(activeOnly) }),
  saveDish: (dish: Partial<Dish>) => call<{ id: string }>('saveDish', { dish: JSON.stringify(dish) }),
  getSettings: () => call<Settings>('getSettings'),
  saveSettings: (settings: Partial<Settings>) => call<Settings>('saveSettings', { settings: JSON.stringify(settings) }),
  createBill: (payload: {
    customerName: string
    customerPhone: string
    items: { dishId: string; name: string; price: number; qty: number }[]
    discount: number
    paymentMethod: string
  }) =>
    call<Bill>('createBill', {
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      items: JSON.stringify(payload.items),
      discount: String(payload.discount),
      paymentMethod: payload.paymentMethod,
    }),
  getBills: (search = '', dateFrom = '', dateTo = '') => call<Bill[]>('getBills', { search, dateFrom, dateTo }),
  getReports: (dateFrom: string, dateTo: string) => call<Reports>('getReports', { dateFrom, dateTo }),
}
