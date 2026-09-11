import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { useAuth, AuthProvider } from './auth/AuthContext'
import { useViewportHeight } from './hooks/useViewportHeight'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Billing from './pages/Billing'
import BillView from './pages/BillView'
import Menu from './pages/Menu'
import SettingsPage from './pages/SettingsPage'
import History from './pages/History'
import Reports from './pages/Reports'
import Tables from './pages/Tables'
import TableOrder from './pages/TableOrder'

// React Router reuses the same mounted component when only a route *param*
// changes (going from /bill/5 straight to /bill/3 doesn't remount BillView),
// so its state (which bill is loaded, whether the PDF was downloaded, any
// error) would otherwise carry over from the previous bill. Keying by billNo
// forces a fresh instance per bill, same as e-attendance's class/section key.
function BillViewRoute() {
  const { billNo } = useParams()
  return <BillView key={billNo} />
}

// Same reasoning as BillViewRoute -- going from /tables/3 straight to
// /tables/5 shouldn't carry table 3's cart/customer/order state over.
function TableOrderRoute() {
  const { tableNumber } = useParams()
  return <TableOrder key={tableNumber} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Billing />} />
      <Route path="/bill/:billNo" element={<BillViewRoute />} />
      <Route path="/tables" element={<Tables />} />
      <Route path="/tables/:tableNumber" element={<TableOrderRoute />} />
      <Route path="/menu" element={<Menu />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/history" element={<History />} />
      <Route path="/reports" element={<Reports />} />
    </Routes>
  )
}

function Shell() {
  const { staff, loading } = useAuth()
  useViewportHeight()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
      </div>
    )
  }
  if (!staff) return <Login />

  return (
    <BrowserRouter>
      {/* A bounded height here (not min-h-screen) is required for <main>'s
          flex-1 to get an actual bounded height -- otherwise the container
          just grows past the viewport instead of clipping, overflow-y-auto
          never engages, the page itself scrolls instead, and
          position:sticky inside <main> breaks (it sticks relative to a box
          that never actually scrolls internally, so it just scrolls away
          with everything else). --app-height (set via useViewportHeight,
          from the real window.innerHeight) is used over 100dvh because
          iOS's WebKit doesn't reliably resolve dvh inside an installed PWA,
          which left a blank gap at the bottom of the screen; 100dvh is kept
          only as the fallback before that effect has run once. */}
      <div
        className="mx-auto flex max-w-md flex-col bg-slate-50"
        style={{ height: 'var(--app-height, 100dvh)' }}
      >
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-4">
          <AppRoutes />
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
