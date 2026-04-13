import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function isLocalLikeHost(hostname) {
  if (!hostname) return false
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  ) {
    return true
  }

  if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
    return true
  }

  const private172Match = hostname.match(/^172\.(\d+)\./)
  if (private172Match) {
    const secondOctet = Number(private172Match[1])
    return secondOctet >= 16 && secondOctet <= 31
  }

  return false
}

function disableLocalServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {})
      })
    })

    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys
          .filter((key) => key.startsWith('immo3d-'))
          .forEach((key) => {
            caches.delete(key).catch(() => {})
          })
      })
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const shouldUseServiceWorker =
  import.meta.env.PROD && !isLocalLikeHost(window.location.hostname)

if (shouldUseServiceWorker && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
} else {
  disableLocalServiceWorker()
}
