import { HashRouter, Route, Routes } from 'react-router-dom'
import { InstallHint } from './components/InstallHint'
import { TabBar } from './components/TabBar'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { Camera } from './screens/Camera'
import { ChooseUsername } from './screens/ChooseUsername'
import { NotConfigured } from './screens/NotConfigured'
import { Portfolio } from './screens/Portfolio'
import { Profile } from './screens/Profile'
import { SignIn } from './screens/SignIn'
import './screens/Screen.css'

// Hash routing (/#/camera) because GitHub Pages has no SPA fallback for deep links.
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
    <>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <InstallHint />
      <TabBar />
    </>
  )
}
