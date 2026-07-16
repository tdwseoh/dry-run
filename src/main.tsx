import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fonts installed at build time (not a runtime @import), per the brief.
import '@fontsource-variable/archivo'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
