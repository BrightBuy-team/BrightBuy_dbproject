import type { ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'

// One place for the app's motion language: short, soft, and switched off for
// people who ask their system for reduced motion.

/** Wrap a page once. Sets the shared timing and honours "reduce motion". */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>{children}</MotionConfig>
}

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ children, delay = 0, className, rise = 16, duration = 0.45 }: {
  children: ReactNode; delay?: number; className?: string; rise?: number; duration?: number
}) {
  return <motion.div className={className} initial={{ opacity: 0, y: rise }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }} transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}>{children}</motion.div>
}

/** A grid or list whose children appear one after another. Use with StaggerItem. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} initial="hidden" whileInView="shown" viewport={{ once: true, margin: '-40px' }}
    variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06 } } }}>{children}</motion.div>
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className}
    variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0 } }}>{children}</motion.div>
}

/** Cross-fades between views. Give it a key that changes with the view. */
export function ViewTransition({ viewKey, children, className }: { viewKey: string; children: ReactNode; className?: string }) {
  return <AnimatePresence mode="wait" initial={false}>
    <motion.div key={viewKey} className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>{children}</motion.div>
  </AnimatePresence>
}

/** A card that lifts slightly under the pointer. */
export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 320, damping: 24 }}>{children}</motion.div>
}

/** Slides a message in and out, for notices that come and go. */
export function Appear({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  return <AnimatePresence initial={false}>
    {show && <motion.div className={className} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>{children}</motion.div>}
  </AnimatePresence>
}
