import { ChevronDown, Menu, User, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import { Logo } from './Logo'
import { useAuth } from '@/hooks/useAuth'
import { isAdminCategory } from '@/types/user'

const NAV_ITEMS = [
  { label: '3D分析', to: '/3d-analysis', adminOnly: false },
  { label: '学会', to: '/conference', adminOnly: false },
  { label: '資料', to: '/documents', adminOnly: false },
  { label: 'データ管理', to: '/data', adminOnly: true },
]

const ACCOUNT_MENU_ITEMS = [
  { label: '設定', to: '/settings', adminOnly: true },
  { label: '計算式設定', to: '/settings/formula', adminOnly: true },
  { label: 'ユーザー管理', to: '/users', adminOnly: true },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { user } = useAuth()
  const isAdmin = isAdminCategory(user?.category)
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const visibleAccountItems = ACCOUNT_MENU_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <header className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-8 lg:px-14">
      <div className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-8 lg:gap-16">
          <Logo />
          <nav className="hidden items-center gap-2 lg:flex lg:gap-8">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 sm:inline-flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-blue-600">
              <User className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-white">{user?.name ?? 'ユーザー'}</span>
            <ChevronDown className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white sm:hidden"
            onClick={() => setIsMenuOpen((value) => !value)}
            title="ユーザーメニュー"
          >
            <User className="h-5 w-5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-14 z-10 w-48 rounded-2xl border border-white/20 bg-white p-2 shadow-2xl shadow-black/10">
              {visibleAccountItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-2xl px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/logout"
                onClick={() => setIsMenuOpen(false)}
                className="block rounded-2xl px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                ログアウト
              </NavLink>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10 lg:hidden"
            title="メニュー"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <nav className="flex flex-col gap-1 pb-4 lg:hidden">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {visibleAccountItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/logout"
            onClick={() => setIsMenuOpen(false)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            ログアウト
          </NavLink>
        </nav>
      )}
    </header>
  )
}
