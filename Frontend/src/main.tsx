import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// The landing page and the sign-in page have separate designs, so each loads
// only its own styles.
const signIn = new URLSearchParams(window.location.search).get('view') === 'login'
const { default: Page } = signIn ? await import('./LoginPage') : await import('./App')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
