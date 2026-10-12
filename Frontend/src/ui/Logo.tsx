/** The BrightBuy shopping-bag mark. Decorative: the wordmark beside it carries the name. */
export function LogoMark() {
  return <svg viewBox="0 0 96 92" fill="none" aria-hidden="true">
    <path d="M52 35C52 26 59 18 68 18s16 8 16 17l2 35c0 5-4 9-9 9H49c-5 0-9-4-9-9Z" fill="#f59f00" />
    <path d="M58 35c0-6 4-10 10-10s10 4 10 10" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity=".6" />
    <path d="m78 12 5-6M90 20l6-3" stroke="#f76707" strokeWidth="4" strokeLinecap="round" />
    <path d="M22 32c0-11 9-20 20-20s20 9 20 20l6 40c1 5-3 10-8 10H12C7 82 3 77 4 72Z" fill="#d9480f" />
    <path d="M30 32c0-8 5-14 12-14s12 6 12 14" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    <path d="M37 56c0-4 5-9 5-13 0 4 5 9 5 13s-5 9-5 13c0-4-5-9-5-13Z" fill="#fff" />
  </svg>
}

export default function Logo({ href = '/', tagline = 'Texas Retail', label = 'BrightBuy home' }: {
  href?: string; tagline?: string; label?: string
}) {
  return <a className="bb-logo" href={href} aria-label={label}>
    <LogoMark />
    <span><span className="bb-logo-word">Bright<em>Buy</em></span><span className="bb-logo-tag">{tagline}</span></span>
  </a>
}
