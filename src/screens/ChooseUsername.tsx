import { UsernameForm } from '../components/UsernameForm'
import { signOut } from '../lib/auth'
import './Screen.css'

// Shown once, right after an account is created: a signed-in person with no
// username yet cannot use the rest of the app.
export function ChooseUsername() {
  return (
    <main className="screen screen-centered">
      <h1 className="title">Pick a username</h1>
      <p className="muted subtitle">This is how your friends find you.</p>
      <UsernameForm />
      <button className="button-link" type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  )
}
