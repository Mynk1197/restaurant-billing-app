import { useAuth } from '../auth/AuthContext'
import { LogoMark } from './icons'

export default function TopBar() {
  const { staff, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <LogoMark className="h-7 w-7" />
        <span className="text-sm font-bold text-gray-800">Restaurant Billing</span>
      </div>
      <button onClick={signOut} className="text-xs font-medium text-gray-400 hover:text-gray-600">
        {staff?.name?.split(' ')[0] ?? 'Sign out'}
      </button>
    </header>
  )
}
