import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CatalogueApp from './catalogue/CatalogueApp'
import './catalogue/catalogue.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CatalogueApp />
  </StrictMode>,
)
