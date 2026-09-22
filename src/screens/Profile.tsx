import { useState } from 'react'
import { UsernameForm } from '../components/UsernameForm'
import { signOut, useAuth } from '../lib/auth'
import './Screen.css'
import './Profile.css'

export function Profile() {
  const { profile } = useAuth()
  const [editing, setEditing] = useState(false)
  const username = profile?.username ?? ''

  return (
    <main className="screen">
      <header className="profile-header">
        <span className="avatar" aria-hidden="true">
          {username.charAt(0).toUpperCase()}
        </span>
        <h1 className="profile-name">@{username}</h1>
        {!editing && (
          <button type="button" className="pill-button" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </header>

      {editing && (
        <section className="profile-section">
          <h2 className="label">Change username</h2>
          <UsernameForm current={username} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
        </section>
      )}

      {/* Stat tiles and friends arrive in later phases; nothing fake in the meantime. */}
      <section className="profile-section">
        <h2 className="label">Settings</h2>
        <ul className="settings-list">
          <li>
            <button type="button" className="settings-row" onClick={() => setEditing(true)}>
              Change username
            </button>
          </li>
          <li>
            <button type="button" className="settings-row" onClick={() => void signOut()}>
              Sign out
            </button>
          </li>
        </ul>
      </section>
    </main>
  )
}
