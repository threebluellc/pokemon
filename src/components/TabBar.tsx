import { NavLink } from 'react-router-dom'
import { CameraIcon, PortfolioIcon, ProfileIcon, RefreshIcon } from './Icons'
import './TabBar.css'

// Three screens (Portfolio, Camera, Profile) plus one action (Refresh) after a divider.
export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink to="/" end className="tab">
        <PortfolioIcon />
        <span>Portfolio</span>
      </NavLink>

      <NavLink to="/camera" className="tab tab-camera" aria-label="Camera">
        <span className="camera-button">
          <CameraIcon size={28} />
        </span>
      </NavLink>

      <NavLink to="/profile" className="tab">
        <ProfileIcon />
        <span>Profile</span>
      </NavLink>

      <span className="tab-divider" aria-hidden="true" />

      {/* Not a screen: it will refresh prices for my own cards. Wired up in Phase 2. */}
      <button type="button" className="tab" disabled aria-label="Refresh prices">
        <RefreshIcon />
        <span>Refresh</span>
      </button>
    </nav>
  )
}
