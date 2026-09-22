import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { db } from '../lib/supabase'
import './Form.css'

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

/**
 * Picks a username, or changes an existing one. The same rules are enforced
 * again in the database, so a broken or hand-made request cannot get past them.
 */
export function UsernameForm({ current, onDone, onCancel }: { current?: string; onDone?: () => void; onCancel?: () => void }) {
  const { session, reloadProfile } = useAuth()
  const [username, setUsername] = useState(current ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const value = username.trim().toLowerCase()
    if (!USERNAME_PATTERN.test(value)) {
      setError('! Use 3 to 20 characters: lowercase letters, numbers and underscores.')
      return
    }
    if (value === current) {
      onDone?.()
      return
    }

    const userId = session?.user.id
    if (!userId) return

    setBusy(true)
    const { error: saveError } = current
      ? await db().from('profiles').update({ username: value }).eq('id', userId)
      : await db().from('profiles').insert({ id: userId, username: value })
    setBusy(false)

    if (saveError) {
      // 23505 is the database saying this username already belongs to someone.
      setError(saveError.code === '23505' ? '! That username is taken. Try another one.' : '! Could not save that username. Please try again.')
      return
    }

    await reloadProfile()
    onDone?.()
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <label className="field">
        <span className="field-label">Username</span>
        <input
          className="field-input"
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={username}
          // Lowercase as they type, so what they see is what gets saved.
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
        />
        <p className="field-hint">3 to 20 characters. Lowercase letters, numbers and underscores.</p>
      </label>

      <button className="button-primary" type="submit" disabled={busy}>
        {busy ? 'Saving…' : current ? 'Save username' : 'Continue'}
      </button>

      {onCancel && (
        <button className="button-link" type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}
