import { ChevronDown, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { FontSizeSelector } from './FontSizeSelector'
import { LanguageSelector } from './LanguageSelector'
import { Logo } from './Logo'
import { INFO_ICON, INFO_MENU_ITEMS, NAV_ITEMS, SETTINGS_MENU_ITEMS } from './navigation'
import { useAuth } from '@/hooks/useAuth'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { useModel3D } from '@/hooks/useModel3D'
import { dropdown, expand } from '@/lib/motion'
import { isAdminCategory } from '@/types/user'

// The global menu, down the left side from the lg width on (narrower windows use
// the top bar, Header). The logo is at the top, the menu items below it and the
// user menu at the bottom.
export function Sidebar() {
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { collapsed, toggle } = useSidebarCollapsed()
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
    `flex items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-medium transition ${
      isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
    }`

  return (
    // z-30: the user menu opens over the page, so nothing on the page (the 3D view's
    // cards, hints) may be drawn over it; dialogs and toasts (z-50) are still above.
    <aside
      className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-blue-600 to-indigo-600 px-2 py-4 transition-[width] lg:flex ${
        collapsed ? 'w-[52px]' : 'w-24'
      }`}
    >
      <div className="flex justify-center">
        <Logo />
      </div>

      <nav className="mt-6 flex flex-col gap-1">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={linkClass}
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
          >
            {collapsed ? <item.icon className="h-5 w-5" /> : item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setIsInfoOpen((value) => !value)}
              aria-expanded={isInfoOpen}
              title={collapsed ? '情報' : undefined}
              aria-label={collapsed ? '情報' : undefined}
              className="flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              {collapsed ? <INFO_ICON className="h-5 w-5" /> : '情報'}
              {!collapsed && (
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isInfoOpen ? 'rotate-180' : ''}`}
                />
              )}
            </button>

            <AnimatePresence initial={false}>
              {isInfoOpen && (
                <motion.div {...expand} className="flex flex-col gap-1 overflow-hidden">
                  {INFO_MENU_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={linkClass}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                    >
                      {collapsed ? <item.icon className="h-5 w-5" /> : item.label}
                    </NavLink>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </nav>

      {/* Collapse to the icons, or open to the text again. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        title={collapsed ? 'メニューを開く' : 'メニューを折りたたむ'}
        aria-label={collapsed ? 'メニューを開く' : 'メニューを折りたたむ'}
        className="mt-auto flex items-center justify-center rounded-xl px-2 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <div ref={menuRef} className="relative mt-1">
        <button
          type="button"
          onClick={() => setIsMenuOpen((value) => !value)}
          aria-expanded={isMenuOpen}
          aria-label={collapsed ? (user?.name ?? 'ユーザー') : undefined}
          title={collapsed ? (user?.name ?? 'ユーザー') : undefined}
          className="flex w-full flex-col items-center gap-1 rounded-xl px-0 py-2 text-white transition hover:bg-white/10"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-blue-600">
            <User className="h-4 w-4" />
          </span>
          {!collapsed && (
            <span className="w-full truncate text-center text-xs font-medium">
              {user?.name ?? 'ユーザー'}
            </span>
          )}
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
              <LanguageSelector tone="light" />
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
