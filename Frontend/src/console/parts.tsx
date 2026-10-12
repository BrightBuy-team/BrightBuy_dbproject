import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

export function PageHeader({ eyebrow, title, text, actions }: { eyebrow: string; title: string; text?: string; actions?: ReactNode }) {
  return <header className="console-page-head">
    <div><p className="bb-eyebrow">{eyebrow}</p><h1>{title}</h1>{text && <p>{text}</p>}</div>
    {actions && <div className="console-page-actions">{actions}</div>}
  </header>
}

export function Kpi({ label, value, hint, icon, tone }: { label: string; value: string; hint?: string; icon: ReactNode; tone?: 'warn' | 'danger' }) {
  return <motion.div className={`bb-card console-kpi ${tone ?? ''}`} variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0 } }}>
    <div className="console-kpi-top"><span>{label}</span><span className="console-kpi-icon">{icon}</span></div>
    <strong className="bb-num">{value}</strong>
    {hint && <small>{hint}</small>}
  </motion.div>
}

/** A row of KPI cards that appear one after another. */
export function KpiRow({ children }: { children: ReactNode }) {
  return <motion.div className="console-kpis" initial="hidden" animate="shown"
    variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06 } } }}>{children}</motion.div>
}

/** Horizontal bars for a short ranked list. Widths animate in. */
export function BarList({ rows, format }: { rows: { label: string; value: number; note?: string }[]; format: (value: number) => string }) {
  const max = Math.max(1, ...rows.map(row => row.value))
  if (!rows.length) return <p className="bb-muted">Nothing to show yet.</p>
  return <ul className="console-bars">{rows.map(row => <li key={row.label}>
    <div><span>{row.label}</span><strong className="bb-num">{format(row.value)}</strong></div>
    <div className="console-bar-track"><motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} /></div>
    {row.note && <small>{row.note}</small>}
  </li>)}</ul>
}

/** A panel that slides in from the right for creating or editing one record. */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return <AnimatePresence>
    {open && <>
      <motion.div className="console-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside className="console-drawer" role="dialog" aria-modal="true" aria-label={title}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
        <header><h2>{title}</h2><button type="button" className="bb-icon-btn" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button></header>
        <div className="console-drawer-body">{children}</div>
      </motion.aside>
    </>}
  </AnimatePresence>
}

/** Success and error messages for a section, announced to screen readers. */
export function Feedback({ notice, error }: { notice?: string; error?: string }) {
  return <AnimatePresence initial={false}>
    {error && <motion.p key="error" className="bb-notice error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{error}</motion.p>}
    {!error && notice && <motion.p key="notice" className="bb-notice" role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{notice}</motion.p>}
  </AnimatePresence>
}
