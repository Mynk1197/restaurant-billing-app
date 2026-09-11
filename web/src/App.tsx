import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { useAuth, AuthProvider } from './auth/AuthContext'
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
      {/* position:fixed + inset-0 anchors directly to the viewport's actual
          edges, so it can't fall short the way every height *unit* did --
          100dvh and even a JS-measured window.innerHeight both still left a
          gap at the bottom in this app's installed-on-iOS-home-screen mode.
          flex+justify-center here handles the mx-auto/max-w-md centering
          that a fixed element's own width can't do via margin auto once
          left/right aren't both set to 0. */}
      <div className="fixed inset-0 flex justify-center bg-slate-50">
        {/* h-full now resolves reliably too, since its parent has a real
            (not computed-from-a-viewport-unit) height. */}
        <div className="flex h-full w-full max-w-md flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto pb-4">
            <AppRoutes />
          </main>
          <BottomNav />
        </div>
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
