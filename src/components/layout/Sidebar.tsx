import { ChevronDown, User } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { FontSizeSelector } from './FontSizeSelector'
import { Logo } from './Logo'
import { INFO_MENU_ITEMS, NAV_ITEMS, SETTINGS_MENU_ITEMS } from './navigation'
import { useAuth } from '@/hooks/useAuth'
import { useModel3D } from '@/hooks/useModel3D'
import { dropdown, expand } from '@/lib/motion'
import { isAdminCategory } from '@/types/user'

// The global menu, down the left side from the lg width on (narrower windows use
// the top bar, Header). The logo is at the top, the menu items below it and the
// user menu at the bottom.
export function Sidebar() {
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const { setModel } = useModel3D()
  const navigate = useNavigate()
  const isAdmin = isAdminCategory(user?.category)
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const menuRef = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    setIsMenuOpen(false)
    await logout()
    setModel(null)
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-2 py-2 text-center text-sm font-medium transition ${
      isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
    }`

  return (
    <aside className="sticky top-0 hidden h-screen w-24 shrink-0 flex-col bg-gradient-to-b from-blue-600 to-indigo-600 px-2 py-4 lg:flex">
      <div className="flex justify-center">
        <Logo />
      </div>

      <nav className="mt-6 flex flex-col gap-1">
        {visibleNavItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setIsInfoOpen((value) => !value)}
              aria-expanded={isInfoOpen}
              className="flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              情報
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isInfoOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {isInfoOpen && (
                <motion.div {...expand} className="flex flex-col gap-1 overflow-hidden">
                  {INFO_MENU_ITEMS.map((item) => (
                    <NavLink key={item.to} to={item.to} className={linkClass}>
                      {item.label}
                    </NavLink>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </nav>

      <div ref={menuRef} className="relative mt-auto">
        <button
          type="button"
          onClick={() => setIsMenuOpen((value) => !value)}
          aria-expanded={isMenuOpen}
          className="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-white transition hover:bg-white/10"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-blue-600">
            <User className="h-4 w-4" />
          </span>
          <span className="w-full truncate text-center text-xs font-medium">
            {user?.name ?? 'ユーザー'}
          </span>
        </button>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              {...dropdown}
              style={{ transformOrigin: 'bottom left' }}
              className="absolute bottom-0 left-full z-20 ml-3 w-48 rounded-2xl border border-white/20 bg-white p-2 shadow-2xl shadow-black/10"
            >
              <NavLink
                to="/help"
                onClick={() => setIsMenuOpen(false)}
                className="block rounded-2xl px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                ヘルプ
              </NavLink>
              {isAdmin && (
                <>
                  <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-gray-400">設定</p>
                  {SETTINGS_MENU_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMenuOpen(false)}
                      className="block rounded-2xl px-3 py-2 pl-6 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </>
              )}
              <FontSizeSelector tone="light" />
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="block w-full rounded-2xl px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                ログアウト
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
