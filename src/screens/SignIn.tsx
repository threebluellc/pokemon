import { useState, type FormEvent } from 'react'
import { db } from '../lib/supabase'
import '../components/Form.css'
import './Screen.css'

// Email and password only. No sign-in links: on an iPhone a link opens in
// Safari, which is a different app from the installed home-screen app and has
// its own separate storage, so the session would land in the wrong place.
export function SignIn() {
  const [creating, setCreating] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (creating && password.length < 8) {
      setError('! Please use a password of at least 8 characters.')
      return
    }

    setBusy(true)
    const credentials = { email: email.trim(), password }
    const { error: authError } = creating
      ? await db().auth.signUp(credentials)
      : await db().auth.signInWithPassword(credentials)
    setBusy(false)

    if (authError) {
      setError(`! ${friendlyMessage(authError.message, creating)}`)
      return
    }
    // On success the auth listener in AuthProvider swaps this screen out.
  }

  return (
    <main className="screen screen-centered">
      <h1 className="title">{creating ? 'Create your account' : 'Welcome back'}</h1>
      <p className="muted subtitle">
        {creating ? 'Your cards and your friends live here.' : 'Sign in to see your portfolio.'}
      </p>

      <form onSubmit={submit} noValidate>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="field-input"
            type="email"
            name="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="field-input"
            type="password"
            name="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {creating && <p className="field-hint">At least 8 characters.</p>}
        </label>

        <button className="button-primary" type="submit" disabled={busy}>
          {busy ? 'One moment…' : creating ? 'Create account' : 'Sign in'}
        </button>

        <button
          className="button-link"
          type="button"
          onClick={() => {
            setCreating(!creating)
            setError(null)
          }}
        >
          {creating ? 'I already have an account' : 'Create an account'}
        </button>
      </form>
    </main>
  )
}

function friendlyMessage(raw: string, creating: boolean): string {
  const text = raw.toLowerCase()
  if (text.includes('invalid login credentials')) return 'That email and password do not match.'
  if (text.includes('already registered')) return 'That email already has an account. Try signing in.'
  if (text.includes('password')) return 'That password is too short or too easy to guess.'
  if (text.includes('email')) return 'Please check the email address.'
  return creating ? 'Could not create the account. Please try again.' : 'Could not sign in. Please try again.'
}
