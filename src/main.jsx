import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { logError } from './lib/logError.js'
import './styles/globals.css'

// Offline shell: cache the app so it opens without signal; localStorage is
// already the source of truth and the outbox syncs shared writes later.
registerSW({ immediate: true })

// Last-resort visibility for anything the ErrorBoundary can't catch —
// event handlers, async code and unhandled promise rejections.
window.addEventListener('error', (e) => logError('window.error', e.error || e.message))
window.addEventListener('unhandledrejection', (e) => logError('unhandledrejection', e.reason))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
