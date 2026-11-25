import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { FontSizeSelector } from './FontSizeSelector'
import { LanguageSelector } from './LanguageSelector'
import { Logo } from './Logo'
import { INFO_MENU_ITEMS, NAV_ITEMS, SETTINGS_MENU_ITEMS } from './navigation'
import { useAuth } from '@/hooks/useAuth'
import { useModel3D } from '@/hooks/useModel3D'
import { expand } from '@/lib/motion'
import { isAdminCategory } from '@/types/user'

// The top bar for phones and narrow windows. From the lg width on, the global
// menu is the left-hand Sidebar instead and this bar is hidden.
export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const { setModel } = useModel3D()
  const navigate = useNavigate()
  const isAdmin = isAdminCategory(user?.category)
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  async function handleLogout() {
    setIsMenuOpen(false)
    await logout()
    setModel(null)
    navigate('/login', { replace: true })
  }

  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:text-white'
    }`

  return (
    <header
      ref={headerRef}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-8 lg:hidden"
    >
      <div className="flex h-16 items-center justify-between">
        <Logo />
        <button
          type="button"
          onClick={() => setIsMenuOpen((value) => !value)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          title="メニュー"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.nav {...expand} className="flex flex-col gap-1 overflow-hidden pb-4">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMenuOpen(false)}
                className={linkClass}
              >
                {item.label}
              </NavLink>
            ))}
            {isAdmin &&
              INFO_MENU_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={linkClass}
                >
                  {item.label}
                </NavLink>
              ))}
            <NavLink to="/help" onClick={() => setIsMenuOpen(false)} className={linkClass}>
              ヘルプ
            </NavLink>
            {isAdmin && (
              <>
                <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-white/60">設定</p>
                {SETTINGS_MENU_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) => `${linkClass({ isActive })} pl-6`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
            <FontSizeSelector tone="dark" />
            <LanguageSelector tone="dark" />
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-white/20"
            >
              ログアウト
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
