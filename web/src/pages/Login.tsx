import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { LogoMark } from '../components/icons'

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return online
}

export default function Login() {
  const { renderSignInButton, loginError, signingIn } = useAuth()
  const online = useOnlineStatus()

  return (
    <div className="relative flex h-[100dvh] flex-col items-center overflow-hidden bg-slate-900 px-6 text-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-linear-to-b from-slate-900 via-orange-950 to-orange-900" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 40px)',
          }}
        />
        <svg className="absolute bottom-0 left-0 w-full text-orange-500/10" viewBox="0 0 400 120" preserveAspectRatio="none">
          <path d="M0,60 C100,110 300,10 400,60 L400,120 L0,120 Z" fill="currentColor" />
        </svg>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-5">
        <LogoMark className="h-16 w-16 drop-shadow-lg" />
        <div>
          <h1 className="text-2xl font-extrabold text-white">Restaurant Billing</h1>
          <p className="mt-1 text-sm text-orange-200">Fast bills, sent straight to WhatsApp.</p>
        </div>
        <div className="relative w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
          {!online && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              You're offline. Connect to the internet to sign in.
            </p>
          )}
          <p className="mb-3 text-sm font-medium text-gray-500">Sign in with your staff Google account</p>

          {signingIn && (
            <div className="flex flex-col items-center gap-3 py-2">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-orange-100 border-t-orange-600" />
              <p className="text-sm font-medium text-gray-600">Signing you in…</p>
              <p className="px-4 text-xs text-gray-400">This can take a few seconds.</p>
            </div>
          )}

          <div className={`flex justify-center ${signingIn ? 'hidden' : ''}`}>
            <div
              ref={(el) => {
                if (el) renderSignInButton(el)
              }}
            />
          </div>
          {loginError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{loginError}</p>}
        </div>
      </div>

      <div className="relative pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        <p className="leading-tight text-orange-200" style={{ fontFamily: "'Caveat', cursive" }}>
          <span className="block text-lg">Designed and Developed By</span>
          <span className="block text-2xl font-bold text-white">Mayank Kushwah</span>
        </p>
        <p className="mt-1 text-[11px] text-orange-300/70">&copy; 2026</p>
      </div>
    </div>
  )
}
