import { motion } from 'motion/react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { page } from '@/lib/motion'

export function MainLayout() {
  const { pathname } = useLocation()
  // The page that has finished rising in. Until then, what sticks out below
  // the window is clipped: it would show a scrollbar for a moment, narrowing
  // the page (and resizing the 3D view) while it rises.
  const [settled, setSettled] = useState<string | null>(null)
  return (
    // The global menu is the left-hand Sidebar from the lg width on; narrower
    // windows get the top bar (Header) instead.
    <div
      className={`flex min-h-screen bg-gray-50 ${settled === pathname ? '' : 'overflow-y-clip'}`}
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        {/* Each page fades in, rising a little. Dialogs, toasts and loading
            screens are rendered into <body>, outside the page, so they never
            move with it. Nothing fades out, so changing page never waits on an
            animation. */}
        <motion.main
          key={pathname}
          initial={page.initial}
          animate={page.animate}
          transition={page.transition}
          onAnimationComplete={() => setSettled(pathname)}
          className="flex-1"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}
