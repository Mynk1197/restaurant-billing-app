import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { LogoMark } from './icons'

export default function TopBar() {
  const { staff, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const initial = staff?.name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <LogoMark className="h-7 w-7" />
        <span className="text-sm font-bold text-gray-800">Restaurant Billing</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700"
        >
          {initial}
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl bg-white text-gray-800 shadow-lg ring-1 ring-black/5">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="truncate text-sm font-semibold">{staff?.name}</p>
                <p className="truncate text-xs text-gray-400">{staff?.email}</p>
              </div>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-1 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
