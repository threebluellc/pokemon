import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PortfolioBrowser } from '../components/PortfolioBrowser'
import { BackIcon } from '../components/Icons'
import { findFriendshipWith, loadFriends, loadPortfolio, removeFriendship } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatAsOf, formatMoney, oldestPriceTime, totalValue } from '../lib/portfolio'
import type { PortfolioItem } from '../lib/types'
import '../components/Form.css'
import './Portfolio.css'
import './Profile.css'
import './Screen.css'

/**
 * A friend's collection, read only.
 *
 * Nothing here trusts the URL: the database only returns their cards if the two
 * of you are accepted friends, so a made-up id simply comes back empty.
 */
export function FriendPortfolio() {
  const { friendId = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user.id ?? ''

  const [username, setUsername] = useState<string | null>(null)
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmUnfriend, setConfirmUnfriend] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const friends = await loadFriends()
      const friend = friends.find((f) => f.friend_id === friendId)
      if (!friend) {
        setError('You are not friends with this person.')
        return
      }
      setUsername(friend.username)
      setItems(await loadPortfolio(friendId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that portfolio.')
    } finally {
      setLoading(false)
    }
  }, [friendId])

  useEffect(() => {
    // Fetching on mount; the state lands after the request, not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const total = useMemo(() => totalValue(items), [items])
  const asOf = useMemo(() => oldestPriceTime(items), [items])

  async function unfriend() {
    if (!confirmUnfriend) {
      setConfirmUnfriend(true)
      return
    }
    setBusy(true)
    try {
      const friendshipId = await findFriendshipWith(myId, friendId)
      if (friendshipId) await removeFriendship(friendshipId)
      navigate('/profile')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unfriend.')
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <header className="confirm-top">
        <button type="button" className="icon-button" onClick={() => navigate('/profile')} aria-label="Back to profile">
          <BackIcon />
        </button>
        <h1 className="confirm-title">{username ? `@${username}'s portfolio` : 'Portfolio'}</h1>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          ! {error}
        </p>
      ) : loading ? (
        <p className="muted loading-note">Loading their cards…</p>
      ) : (
        <>
          <p className="label">Portfolio value</p>
          <p className="big-number">{formatMoney(total)}</p>
          {/* Their prices come from the same shared cache, but they refresh their
              own cards, so this can be older than yours. */}
          <p className="muted">
            {items.length === 0
              ? 'TCGplayer market prices, Near Mint'
              : `TCGplayer market prices · as of ${formatAsOf(asOf)}`}
          </p>

          <PortfolioBrowser
            items={items}
            searchLabel={`Search @${username}'s collection`}
            emptyTitle="Nothing here yet"
            emptyBody={`@${username} has not added any cards.`}
          />

          <button type="button" className="button-danger unfriend" disabled={busy} onClick={() => void unfriend()}>
            {confirmUnfriend ? `Tap again to unfriend @${username}` : `Unfriend @${username}`}
          </button>
        </>
      )}
    </main>
  )
}
