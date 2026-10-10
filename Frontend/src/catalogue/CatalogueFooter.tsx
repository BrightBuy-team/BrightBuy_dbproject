import { contactEmail } from './contact'

export default function CatalogueFooter({ email = import.meta.env.VITE_BRIGHTBUY_CONTACT_EMAIL ?? 'support@brightbuy.example' }: { email?: string }) {
  const contact = contactEmail(email)
  const demo = contact?.toLowerCase().endsWith('.example')
  return <footer className="catalogue-footer" aria-label="BrightBuy information">
    <section aria-labelledby="footer-contact-heading">
      <p className="catalogue-footer-brand">BrightBuy</p>
      <h2 id="footer-contact-heading">Contact</h2>
      {contact ? demo ? <><p>{contact}</p><p className="catalogue-footer-pending">Demo address — not a working mailbox.</p></> : <a href={`mailto:${contact}`}>{contact}</a>
        : <p>Contact details will be published when confirmed.</p>}
    </section>
    <section aria-labelledby="footer-delivery-heading">
      <h2 id="footer-delivery-heading">Delivery policy</h2>
      <p>Standard Delivery is limited to Texas. Store Pickup is also available.</p>
      <p>Delivery estimates depend on destination and stock availability. Store Pickup does not use city-based estimates.</p>
    </section>
    <section aria-labelledby="footer-payment-heading">
      <h2 id="footer-payment-heading">Payment methods</h2>
      <p>Cash on Delivery and Card Payment are available. Prices are shown in USD.</p>
      <p className="catalogue-footer-pending">Card payments are simulated in this phase: no real card is charged. Checkout requires a confirmed account session; adding an item to the cart does not place an order.</p>
    </section>
  </footer>
}
