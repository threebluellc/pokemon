import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ChevronIcon, CloseIcon } from '../components/Icons'
import { UsernameForm } from '../components/UsernameForm'
import {
  acceptFriendRequest,
  loadFriendRequests,
  loadFriends,
  removeFriendship,
  sendFriendRequest,
  type FriendRequest,
  type FriendSummary,
} from '../lib/api'
import { signOut, useAuth } from '../lib/auth'
import { formatAsOfDay, formatMoney, oldestPriceTime, totalCards, totalValue } from '../lib/portfolio'
import { usePortfolio } from '../lib/usePortfolio'
import '../components/Form.css'
import './Profile.css'
import './Screen.css'

export function Profile() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const { items } = usePortfolio()
  const myId = session?.user.id ?? ''
  const username = profile?.username ?? ''

  const [editing, setEditing] = useState(false)
  const [friends, setFriends] = useState<FriendSummary[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [addName, setAddName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const cards = useMemo(() => totalCards(items), [items])
  const value = useMemo(() => totalValue(items), [items])
  const asOf = useMemo(() => oldestPriceTime(items), [items])

  const refreshFriends = useCallback(async () => {
    try {
      const [nextFriends, nextRequests] = await Promise.all([loadFriends(), loadFriendRequests()])
      setFriends(nextFriends)
      setRequests(nextRequests)
      setError(null)
    } catch (e) {
      setError(`! ${e instanceof Error ? e.message : 'Could not load your friends.'}`)
    }
  }, [])

  useEffect(() => {
    // Fetching on mount; the state lands after the request, not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshFriends()
  }, [refreshFriends])

  const incoming = requests.filter((r) => r.direction === 'incoming')
  const outgoing = requests.filter((r) => r.direction === 'outgoing')

  async function run(action: () => Promise<string | void>) {
    setBusy(true)
    setError(null)
    try {
      const message = await action()
      if (message) setNote(message)
      await refreshFriends()
    } catch (e) {
      setError(`! ${e instanceof Error ? e.message : 'That did not work.'}`)
    } finally {
      setBusy(false)
    }
  }

  function add(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      const name = await sendFriendRequest(myId, addName)
      setAddName('')
      return `Request sent to @${name}.`
    })
  }

  return (
    <main className="screen">
      <header className="profile-header">
        <Avatar username={username} mine />
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

      <section className="stat-row">
        <div className="stat">
          <strong>{cards}</strong>
          <span>Cards</span>
        </div>
        <div className="stat">
          <strong>{formatMoney(value)}</strong>
          <span>Total value</span>
        </div>
        <div className="stat">
          <strong>{formatAsOfDay(asOf)}</strong>
          <span>Prices as of</span>
        </div>
      </section>

      <section className="profile-section">
        <h2 className="section-heading">
          Friends <span className="count">{friends.length}</span>
        </h2>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {note && (
          <button type="button" className="toast" onClick={() => setNote(null)}>
            {note} <span aria-hidden="true">✕</span>
          </button>
        )}

        <form className="add-friend" onSubmit={add}>
          <input
            className="field-input"
            type="text"
            placeholder="Add a friend by username"
            aria-label="Add a friend by username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={addName}
            onChange={(e) => setAddName(e.target.value.toLowerCase())}
          />
          <button type="submit" className="button-primary add-button" disabled={busy || addName.trim().length < 3}>
            Add
          </button>
        </form>

        {incoming.map((request) => (
          <div className="request-banner" key={request.friendship_id}>
            <p>
              <strong>@{request.username}</strong> wants to be friends
            </p>
            <button
              type="button"
              className="button-primary accept-button"
              disabled={busy}
              onClick={() => void run(() => acceptFriendRequest(request.friendship_id))}
            >
              Accept
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Decline the request from ${request.username}`}
              disabled={busy}
              onClick={() => void run(() => removeFriendship(request.friendship_id))}
            >
              <CloseIcon />
            </button>
          </div>
        ))}

        {outgoing.map((request) => (
          <div className="friend-row friend-row-static" key={request.friendship_id}>
            <Avatar username={request.username} />
            <span className="friend-text">
              <span className="friend-name">@{request.username}</span>
              <span className="muted">Requested</span>
            </span>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void run(() => removeFriendship(request.friendship_id))}
            >
              Cancel
            </button>
          </div>
        ))}

        {friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
          <p className="muted">No friends yet. Add one by username above.</p>
        )}

        {friends.map((friend) => (
          <button
            type="button"
            className="friend-row"
            key={friend.friend_id}
            onClick={() => navigate(`/friend/${friend.friend_id}`)}
          >
            <Avatar username={friend.username} />
            <span className="friend-text">
              <span className="friend-name">@{friend.username}</span>
              <span className="muted">
                {friend.card_count} {friend.card_count === 1 ? 'card' : 'cards'} ·{' '}
                {formatMoney(Number(friend.total_value))}
              </span>
            </span>
            <ChevronIcon />
          </button>
        ))}
      </section>

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
