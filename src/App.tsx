import { HashRouter, Route, Routes } from 'react-router-dom'
import { InstallHint } from './components/InstallHint'
import { TabBar } from './components/TabBar'
import { Camera } from './screens/Camera'
import { Portfolio } from './screens/Portfolio'
import { Profile } from './screens/Profile'

// Hash routing (/#/camera) because GitHub Pages has no SPA fallback for deep links.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <InstallHint />
      <TabBar />
    </HashRouter>
  )
}
