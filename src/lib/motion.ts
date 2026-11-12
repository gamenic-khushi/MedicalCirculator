import type { MotionProps, Transition } from 'motion/react'

// How the app moves, kept in one place so it can be tuned as a whole. Short and
// calm: in a clinical tool an animation confirms what happened and never makes
// anyone wait. Screens set to reduce motion get the fades only (MotionConfig in
// App.tsx drops movement and scaling for them).

/** Fast start, gentle stop: for things arriving. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** A soft spring with almost no overshoot: for dialogs, cards and markers. */
export const SPRING: Transition = { type: 'spring', visualDuration: 0.28, bounce: 0.12 }

/** Backdrops, overlays and whole pages: opacity only. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.15 } },
  transition: { duration: 0.2, ease: EASE_OUT },
} satisfies MotionProps

/** Dialogs, toasts and banners: rise and grow a little into place, sink away on close. */
export const pop = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.12 } },
  transition: SPRING,
} satisfies MotionProps

/** Menus dropping from their button. */
export const dropdown = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, transition: { duration: 0.1 } },
  transition: { duration: 0.16, ease: EASE_OUT },
} satisfies MotionProps

/** Sections opening and closing in place (height to and from its natural size). */
export const expand = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0, transition: { duration: 0.15 } },
  transition: { duration: 0.22, ease: EASE_OUT },
} satisfies MotionProps
