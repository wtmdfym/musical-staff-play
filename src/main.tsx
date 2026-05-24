import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getVerovioRenderer } from './renderer/VerovioEngine'

getVerovioRenderer().init().catch(err => console.warn('Verovio init failed:', err))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
