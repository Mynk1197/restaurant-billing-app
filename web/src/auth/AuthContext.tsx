import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type Staff } from '../api/api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

interface AuthState {
  staff: Staff | null
  loading: boolean
  signingIn: boolean
  loginError: string | null
  signOut: () => void
  renderSignInButton: (el: HTMLElement) => void
}

const AuthContext = createContext<AuthState>({
  staff: null,
  loading: true,
  signingIn: false,
  loginError: null,
  signOut: () => {},
  renderSignInButton: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
          prompt: () => void
        }
      }
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const cachedStaff = localStorage.getItem('staff')
    const idToken = localStorage.getItem('idToken')
    if (cachedStaff && idToken) {
      setStaff(JSON.parse(cachedStaff))
      setLoading(false)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          setLoginError(null)
          setSigningIn(true)
          try {
            const result = await api.login(response.credential)
            localStorage.setItem('staff', JSON.stringify(result))
            setStaff(result)
          } catch (err) {
            console.error(err)
            localStorage.removeItem('idToken')
            setLoginError('Sign-in failed: this Google account is not an authorized staff account.')
          } finally {
            setSigningIn(false)
          }
        },
      })
      initializedRef.current = true
      setLoading(false)
    }
    document.body.appendChild(script)
  }, [])

  const signOut = () => {
    localStorage.removeItem('idToken')
    localStorage.removeItem('staff')
    // Google's Identity Services button ties its internal state to the
    // credential already used in this page load, so re-rendering it into
    // a fresh div after sign-out often stays blank. A full reload gives
    // it a clean slate, same as a first visit.
    window.location.reload()
  }

  const renderSignInButton = (el: HTMLElement) => {
    if (initializedRef.current && window.google) {
      window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 280 })
    }
  }

  return (
    <AuthContext.Provider value={{ staff, loading, signingIn, loginError, signOut, renderSignInButton }}>
      {children}
    </AuthContext.Provider>
  )
}
