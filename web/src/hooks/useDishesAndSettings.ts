import { useEffect, useState } from 'react'
import { api, type Dish, type Settings } from '../api/api'
import { db } from '../db/db'

// Dishes and GST settings change rarely, but every screen that needs them
// was waiting on a full network round trip before showing anything, even
// though a Dexie cache of the last-fetched copy already existed as an
// offline-only fallback. Showing that cached copy immediately (if any) and
// refreshing from the network in the background -- instead of network-first
// with cache only on failure -- makes Billing/Tables feel instant on repeat
// visits. First-ever load (empty cache) still waits on the network, same as
// before.
export function useDishesAndSettings() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const [cachedDishes, cachedSettings] = await Promise.all([
        db.dishes.where('Active').equals('Y').toArray(),
        db.settings.get('settings'),
      ])
      if (cancelled) return
      const hadCache = cachedDishes.length > 0 && !!cachedSettings
      if (hadCache) {
        setDishes(cachedDishes)
        setSettings(cachedSettings!.value)
        setLoading(false)
      }

      try {
        const [freshDishes, freshSettings] = await Promise.all([api.getDishes(true), api.getSettings()])
        if (cancelled) return
        setDishes(freshDishes)
        setSettings(freshSettings)
        await db.dishes.bulkPut(freshDishes)
        await db.settings.put({ key: 'settings', value: freshSettings })
      } catch {
        // Cache already showing (if any); nothing more to fall back to
        // otherwise -- offline with no prior visit just stays empty.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { dishes, settings, loading }
}
