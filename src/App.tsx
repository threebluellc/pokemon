import { HashRouter, Route, Routes } from 'react-router-dom'
import { InstallHint } from './components/InstallHint'
import { TabBar } from './components/TabBar'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { PortfolioProvider } from './lib/usePortfolio'
import { AddCard } from './screens/AddCard'
import { Camera } from './screens/Camera'
import { ChooseUsername } from './screens/ChooseUsername'
import { FriendPortfolio } from './screens/FriendPortfolio'
import { NotConfigured } from './screens/NotConfigured'
import { Portfolio } from './screens/Portfolio'
import { Profile } from './screens/Profile'
import { SignIn } from './screens/SignIn'
import './screens/Screen.css'

// Hash routing (/#/add) because GitHub Pages has no SPA fallback for deep links.
export default function App() {
  if (!isConfigured) return <NotConfigured />

  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  )
}

// Three doors: signed out, signed in without a username, and the app proper.
function Gate() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <main className="screen screen-centered">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  if (!session) return <SignIn />
  if (!profile) return <ChooseUsername />

  return (
    <PortfolioProvider>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/add" element={<AddCard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/friend/:friendId" element={<FriendPortfolio />} />
      </Routes>
      <InstallHint />
      <TabBar />
    </PortfolioProvider>
  )
}
