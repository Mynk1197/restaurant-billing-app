import { db } from './db'
import { api } from '../api/api'

let syncing = false

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 }
  syncing = true
  let synced = 0
  let failed = 0
  try {
    const pending = await db.billQueue.orderBy('id').toArray()
    for (const item of pending) {
      try {
        await api.createBill({
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          items: item.items,
          discount: item.discount,
          paymentMethod: item.paymentMethod,
        })
        if (item.id !== undefined) await db.billQueue.delete(item.id)
        synced++
      } catch {
        failed++
        break // stop on first failure (likely offline again or auth issue); retry later
      }
    }
  } finally {
    syncing = false
  }
  return { synced, failed }
}

export function startSyncManager() {
  window.addEventListener('online', () => {
    flushQueue()
  })
  // periodic retry every 60s in case 'online' event was missed
  setInterval(() => {
    flushQueue()
  }, 60_000)
  // attempt once on startup
  flushQueue()
}

export async function pendingCount(): Promise<number> {
  return db.billQueue.count()
}
