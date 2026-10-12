import { ArrowRight, Boxes, Clock3, CreditCard, LayoutDashboard, PackageCheck, ShieldCheck, ShoppingBag, Truck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { useSession } from './catalogue/useSession'
import { landingPage } from './console/roles'
import Logo from './ui/Logo'
import { MotionRoot, Reveal, Stagger, StaggerItem } from './ui/motion'
import './ui/theme.css'
import './App.css'

const doors = [
  { role: 'customer', icon: <ShoppingBag aria-hidden="true" />, title: 'Customers', text: 'Shop the catalogue, check out and follow your orders.',
    points: ['Browse and search products', 'Delivery or store pickup', 'Order history and delivery dates'], action: 'Customer sign-in' },
  { role: 'employee', icon: <Boxes aria-hidden="true" />, title: 'Employees', text: 'Warehouse staff and management open the staff console.',
    points: ['Stock and variants', 'Products and categories', 'Sales reports for management'], action: 'Employee sign-in' },
  { role: 'admin', icon: <ShieldCheck aria-hidden="true" />, title: 'Administrators', text: 'Manage staff accounts and oversee the catalogue and stock.',
    points: ['Create staff accounts', 'Operations overview', 'Catalogue and inventory'], action: 'Admin sign-in' },
]

const promises = [
  { icon: <Truck aria-hidden="true" />, title: '5 or 7 day delivery', text: 'Main Texas cities in 5 days, other cities in 7.' },
  { icon: <PackageCheck aria-hidden="true" />, title: 'Store pickup', text: 'Order online and collect at the store.' },
  { icon: <CreditCard aria-hidden="true" />, title: 'Cash or card', text: 'Pay on delivery, or by card at checkout.' },
  { icon: <Clock3 aria-hidden="true" />, title: 'Out of stock? Still order', text: 'Back-ordered items arrive 3 days later.' },
]

export default function App() {
  const { data: user } = useSession()
  const home = user ? landingPage(user) : null
  // The header floats clear over the cloud photograph and turns solid once the page moves.
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', value => setScrolled(value > 40))
  return <MotionRoot><div className="landing">
    <header className={`landing-header${scrolled ? ' solid' : ''}`}><div className="bb-container">
      <Logo href="/" />
      <nav aria-label="Site navigation">
        <a href="/catalogue.html">Shop</a>
        <a href="/delivery.html">Track delivery</a>
        {home ? <a className="bb-btn bb-btn-primary bb-btn-sm" href={home}>{user?.accountType === 'CUSTOMER' ? <UserRound aria-hidden="true" /> : <LayoutDashboard aria-hidden="true" />}
          {user?.accountType === 'CUSTOMER' ? 'My shop' : 'Open console'}</a>
          : <a className="bb-btn bb-btn-primary bb-btn-sm" href="/?view=login">Sign in</a>}
      </nav>
    </div></header>

    <main>
      <section className="landing-hero">
        <motion.div className="landing-hero-content" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <p className="landing-badge">Welcome to BrightBuy</p>
          <h1>Elevate Your<br /><span>Shopping Experience</span></h1>
          <p className="landing-lead">Phones, laptops, audio, smart devices and toys from one central warehouse. Delivered to your door or ready for store pickup.</p>
          <div className="landing-actions">
            <a className="landing-pill" href="/catalogue.html">Start shopping<ArrowRight aria-hidden="true" /></a>
            {!home && <a className="landing-pill glass" href="/?view=login">Sign in or register</a>}
          </div>
        </motion.div>
      </section>

      <section className="landing-reveal">
        <Reveal rise={50} duration={1.2}>
          <h2>Good finds.<br /><span>Everyday possibilities.</span></h2>
          <p>Explore the collection. Find the details that make it yours.</p>
          <a className="landing-pill" href="/catalogue.html">Shop Collection</a>
        </Reveal>
      </section>

      <section className="landing-promise-band"><div className="bb-container">
        <Stagger className="landing-promises">{promises.map(item => <StaggerItem key={item.title} className="bb-card">
          <span>{item.icon}</span><div><strong>{item.title}</strong><p>{item.text}</p></div></StaggerItem>)}</Stagger>
      </div></section>

      <section className="landing-doors" aria-labelledby="doors-heading"><div className="bb-container">
        <Reveal><p className="bb-eyebrow">Three ways in</p>
          <h2 id="doors-heading">Sign in to your part of BrightBuy</h2>
          <p className="bb-muted">Each kind of account has its own sign-in and its own pages.</p></Reveal>
        <Stagger className="landing-door-grid">{doors.map(door => <StaggerItem key={door.role}>
          <motion.article className="bb-card bb-card-pad" whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
            <span className="landing-door-icon">{door.icon}</span>
            <h3>{door.title}</h3>
            <p>{door.text}</p>
            <ul>{door.points.map(point => <li key={point}>{point}</li>)}</ul>
            <a className="bb-btn bb-btn-block" href={`/?view=login&role=${door.role}`}>{door.action}<ArrowRight aria-hidden="true" /></a>
          </motion.article></StaggerItem>)}</Stagger>
      </div></section>
    </main>

    <footer className="landing-footer"><div className="bb-container">
      <Logo href="/" />
      <p>© 2026 BrightBuy. Database Systems project, Group 14. Card payments and emails are simulated in this phase.</p>
    </div></footer>
  </div></MotionRoot>
}
