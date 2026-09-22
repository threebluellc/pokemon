import { useState } from 'react'
import { CloseIcon, ShareIcon } from './Icons'
import './InstallHint.css'

const DISMISS_KEY = 'install-hint-dismissed'

// True only in regular iPhone/iPad Safari, not once the app is installed to the home screen.
function shouldShowHint(): boolean {
  const ua = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua)
  // Chrome, Firefox and Edge on iOS include these tokens; the hint is Safari-specific
  const isSafari = isIos && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  const isInstalled =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  if (!isSafari || isInstalled) return false
  try {
    return localStorage.getItem(DISMISS_KEY) !== '1'
  } catch {
    return true // storage can be blocked; showing the hint is harmless
  }
}

export function InstallHint() {
  const [visible, setVisible] = useState(shouldShowHint)
  if (!visible) return null

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Not remembered, so the hint returns next visit. Acceptable.
    }
  }

  return (
    <aside className="install-hint" role="note">
      <p>
        Install this app: tap <ShareIcon /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
      </p>
      <button type="button" className="install-hint-close" onClick={dismiss} aria-label="Dismiss install hint">
        <CloseIcon />
      </button>
    </aside>
  )
}
