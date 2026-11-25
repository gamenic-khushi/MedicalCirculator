import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startDomTranslation } from './lib/domTranslation'
import { initFontSize } from './lib/fontSize'
import { initLanguage } from './lib/language'

initFontSize()
initLanguage()
startDomTranslation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
