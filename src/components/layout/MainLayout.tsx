import { motion } from 'motion/react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { Header } from './Header'
import { page } from '@/lib/motion'

export function MainLayout() {
  const { pathname } = useLocation()
  // The page that has finished rising in. Until then, what sticks out below
  // the window is clipped: it would show a scrollbar for a moment, narrowing
  // the page (and resizing the 3D view) while it rises.
  const [settled, setSettled] = useState<string | null>(null)
  return (
    <div
      className={`flex min-h-screen flex-col bg-gray-50 ${settled === pathname ? '' : 'overflow-y-clip'}`}
    >
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
  )
}
