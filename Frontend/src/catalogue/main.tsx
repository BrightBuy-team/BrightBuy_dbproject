import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CatalogueApp from './CatalogueApp'
import '../ui/theme.css'
import './catalogue.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><CatalogueApp /></StrictMode>,
)
