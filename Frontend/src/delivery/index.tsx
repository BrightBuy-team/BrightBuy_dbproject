import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DeliveryApp from './DeliveryApp'
import '../ui/theme.css'
import './DeliveryApp.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><DeliveryApp /></StrictMode>,
)
