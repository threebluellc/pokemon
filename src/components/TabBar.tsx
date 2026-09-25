import { NavLink, useLocation } from 'react-router-dom'
import { useTabBarHidden } from '../lib/tabBarVisibility'
import { usePortfolio } from '../lib/usePortfolio'
import { CameraIcon, PortfolioIcon, ProfileIcon, RefreshIcon } from './Icons'
import './TabBar.css'

// Three screens (Portfolio, Add, Profile) plus one action (Refresh) after a divider.
export function TabBar() {
  const { refresh, startRefresh } = usePortfolio()
  const hidden = useTabBarHidden()
  const { running, done, total } = refresh

  // Refresh always updates your own cards, wherever you are. That is easy to
  // misread while a friend's collection fills the screen, so the label says
  // whose prices are about to change.
  const viewingFriend = useLocation().pathname.startsWith('/friend/')
  const idleLabel = viewingFriend ? 'My prices' : 'Refresh'

  // Unmounted rather than merely invisible, so nothing under the camera can
  // still be reached by keyboard or a screen reader.
  if (hidden) return null

  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink to="/" end className="tab">
        <PortfolioIcon />
        <span>Portfolio</span>
      </NavLink>

      <NavLink to="/camera" className="tab tab-camera" aria-label="Scan a card">
        <span className="camera-button">
          <CameraIcon size={28} />
        </span>
      </NavLink>

      <NavLink to="/profile" className="tab">
        <ProfileIcon />
        <span>Profile</span>
      </NavLink>

      <span className="tab-divider" aria-hidden="true" />

      <button
        type="button"
        className="tab"
        onClick={startRefresh}
        disabled={running}
        aria-label={running ? `Updating your prices, ${done} of ${total}` : 'Refresh the prices of your own cards'}
      >
        {running ? <ProgressRing done={done} total={total} /> : <RefreshIcon />}
        <span>{running ? (total === 0 ? '…' : `${done}/${total}`) : idleLabel}</span>
      </button>
    </nav>
  )
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 9
  const circumference = 2 * Math.PI * radius
  const fraction = total > 0 ? done / total : 0

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="progress-ring">
      <circle cx="12" cy="12" r={radius} fill="none" stroke="var(--border-control)" strokeWidth="2.4" />
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform="rotate(-90 12 12)"
      />
    </svg>
  )
}
