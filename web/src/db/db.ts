import Dexie, { type Table } from 'dexie'
import type { Dish, Settings } from '../api/api'

export interface QueuedBill {
  id?: number
  customerName: string
  customerPhone: string
  items: { dishId: string; name: string; category: string; price: number; qty: number }[]
  discount: number
  paymentMethod: string
  createdAt: string
}

class BillingDB extends Dexie {
  dishes!: Table<Dish, string>
  settings!: Table<{ key: string; value: Settings }, string>
  billQueue!: Table<QueuedBill, number>

  constructor() {
    super('restaurant-billing')
    this.version(1).stores({
      dishes: 'Id, Category, Active',
      settings: 'key',
      billQueue: '++id, createdAt',
    })
  }
}

export const db = new BillingDB()
