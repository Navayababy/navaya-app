import { useEffect, useState } from 'react'
import { brand, palette } from '../theme.js'
import { getInstallBannerDismissed, dismissInstallBanner } from '../lib/storage.js'

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

// Nudges a browser visitor towards the installed app. Android/Chrome/Edge
// expose a real "beforeinstallprompt" event we can trigger ourselves; iOS
// Safari has no such API at all, so that path can only ever be instructions.
export default function InstallBanner({ night }) {
  const p = palette(night)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => getInstallBannerDismissed())
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => { dismissInstallBanner(); setDismissed(true) }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  if (installed || dismissed) return null
  // Nothing to offer: not iOS, and the browser hasn't (yet) signalled the
  // site is installable — most likely already installed, or an unsupported
  // desktop browser.
  if (!isIOS() && !deferredPrompt) return null

  return (
    <div className="fade-up" style={{
      margin: '8px 14px 0', background: p.card, border: `1px solid ${p.border}`,
      borderRadius: 16, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${brand.sand}29`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
        📲
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: p.text }}>Add Navaya to your home screen</span>
        <span style={{ display: 'block', fontSize: 12, color: p.sub, lineHeight: 1.45, marginTop: 2 }}>
          {isIOS() && !deferredPrompt
            ? <>Tap <strong>Share</strong>, then <strong>&quot;Add to Home Screen&quot;</strong>.</>
            : 'Get the full app experience — one tap, no app store.'}
        </span>
      </div>
      {deferredPrompt && (
        <button onClick={handleInstall} style={{ background: brand.bark, border: 'none', borderRadius: 12, padding: '9px 14px', cursor: 'pointer', color: brand.sand, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: p.sub, lineHeight: 1, flexShrink: 0 }}>
        ×
      </button>
    </div>
  )
}
