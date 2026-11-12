import { motion } from 'motion/react'
import { Outlet, useLocation } from 'react-router-dom'

import { Header } from './Header'
import { fade } from '@/lib/motion'

export function MainLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      {/* Each page fades in. Opacity only: a moving page would, while it moves,
          shift where its fixed overlays (dialogs, toasts) are placed. Nothing
          fades out, so changing page never waits on an animation. */}
      <motion.main
        key={pathname}
        initial={fade.initial}
        animate={fade.animate}
        transition={fade.transition}
        className="flex-1"
      >
        <Outlet />
      </motion.main>
    </div>
  )
}
