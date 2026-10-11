import { useEffect, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { BarChart3, Boxes, FolderTree, LayoutDashboard, LogOut, PackageSearch, ShieldCheck, Store, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSession, useSignOut } from '../catalogue/useSession'
import Logo from '../ui/Logo'
import { MotionRoot, ViewTransition } from '../ui/motion'
import { resolveSection, roleTitles, sectionLabels, sectionsFor } from './roles'
import type { SectionId } from './roles'
import Overview from './Overview'
import InventorySection from './InventorySection'
import ProductsSection from './ProductsSection'
import CategoriesSection from './CategoriesSection'
import ReportsSection from './ReportsSection'
import StaffSection from './StaffSection'

const icons: Record<SectionId, ReactNode> = {
  overview: <LayoutDashboard aria-hidden="true" />, inventory: <Boxes aria-hidden="true" />,
  products: <PackageSearch aria-hidden="true" />, categories: <FolderTree aria-hidden="true" />,
  reports: <BarChart3 aria-hidden="true" />, staff: <Users aria-hidden="true" />,
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

function open(section: SectionId) {
  window.history.pushState(null, '', `/console.html?section=${section}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

function Gate({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <main className="console-gate"><div className="bb-card bb-card-pad">
    <Logo href="/" tagline="Staff console" />
    <h1>{title}</h1><p>{text}</p>{children}
  </div></main>
}

export default function ConsoleApp() {
  const session = useSession()
  const { signOut, signingOut, error: signOutError } = useSignOut('/')
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => '')
  const user = session.data
  const role = user?.accountType === 'EMPLOYEE' ? user.role : ''
  // inventory.html is the old address of the warehouse page and still opens it.
  const requested = new URLSearchParams(search).get('section')
    ?? (window.location.pathname.endsWith('inventory.html') ? 'inventory' : null)
  const section = resolveSection(role, requested)

  useEffect(() => {
    document.title = `${section ? sectionLabels[section] : 'Staff console'} · BrightBuy console`
  }, [section])

  if (session.loading) return <Gate title="Checking your session" text="One moment…"><div className="bb-spinner" role="status" aria-label="Loading" /></Gate>
  if (session.error) return <Gate title="The console is unavailable" text={session.error}>
    <button className="bb-btn bb-btn-primary" onClick={session.retry}>Try again</button></Gate>
  if (!user || user.accountType !== 'EMPLOYEE' || !section) return <Gate title="Staff sign-in required"
    text={user ? 'This area is for BrightBuy employees. You are signed in with a customer account.' : 'Sign in with your employee account to open the console.'}>
    <div className="console-gate-actions">
      <a className="bb-btn bb-btn-primary" href="/?view=login&role=employee">Employee sign-in</a>
      <a className="bb-btn" href="/?view=login&role=admin">Admin sign-in</a>
      <a className="bb-btn bb-btn-ghost" href="/catalogue.html">Go to the shop</a>
    </div></Gate>

  const sections = sectionsFor(role)
  return <MotionRoot><div className="console">
    <aside className="console-sidebar">
      <Logo href="/console.html" tagline="Staff console" label="Console home" />
      <p className="console-role"><ShieldCheck aria-hidden="true" />{roleTitles[role] ?? role}</p>
      <nav aria-label="Console sections">
        {sections.map(id => <button key={id} type="button" className={id === section ? 'active' : ''}
          aria-current={id === section ? 'page' : undefined} onClick={() => open(id)}>
          {id === section && <motion.span layoutId="console-active" className="console-nav-pill" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
          {icons[id]}<span>{sectionLabels[id]}</span>
        </button>)}
      </nav>
      <div className="console-sidebar-foot">
        <a href="/catalogue.html"><Store aria-hidden="true" />View the shop</a>
        <button type="button" onClick={signOut} disabled={signingOut}><LogOut aria-hidden="true" />{signingOut ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </aside>
    <div className="console-main">
      <header className="console-topbar">
        <div><span className="bb-muted">Console</span><span aria-hidden="true"> / </span><strong>{sectionLabels[section]}</strong></div>
        <div className="console-user"><span>{user.email}</span><span className="bb-chip plain">{roleTitles[role] ?? role}</span></div>
      </header>
      {signOutError && <p className="bb-notice error" role="alert">{signOutError}</p>}
      <main className="console-content" id="console-content">
        <ViewTransition viewKey={section}>
          {section === 'overview' ? <Overview role={role} open={open} />
            : section === 'inventory' ? <InventorySection />
            : section === 'products' ? <ProductsSection />
            : section === 'categories' ? <CategoriesSection />
            : section === 'reports' ? <ReportsSection />
            : <StaffSection />}
        </ViewTransition>
      </main>
    </div>
  </div></MotionRoot>
}
