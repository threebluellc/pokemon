import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { loadPortfolio, ProxyError, refreshBegin, refreshChunk } from './api'
import { useAuth } from './auth'
import type { PortfolioItem } from './types'

/** Must not exceed the Edge Function's own per-call cap. */
const CHUNK_SIZE = 20

type RefreshState = { running: boolean; done: number; total: number; note: string | null }

type PortfolioValue = {
  items: PortfolioItem[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  refresh: RefreshState
  startRefresh: () => void
  dismissNote: () => void
}

const IDLE: RefreshState = { running: false, done: 0, total: 0, note: null }

const PortfolioContext = createContext<PortfolioValue | null>(null)

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState<RefreshState>(IDLE)
  // Guards against a second refresh starting while one is already walking chunks.
  const running = useRef(false)

  const reload = useCallback(async () => {
    if (!userId) return
    try {
      setItems(await loadPortfolio(userId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your portfolio.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // Loading the portfolio when the signed-in person changes is exactly the
    // "fetch on mount" case; the state lands after the request, not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const startRefresh = useCallback(() => {
    if (running.current || !userId) return
    running.current = true
    setRefresh({ running: true, done: 0, total: 0, note: null })

    void (async () => {
      try {
        const cardIds = await refreshBegin()
        if (cardIds.length === 0) {
          setRefresh({ running: false, done: 0, total: 0, note: 'Nothing to refresh yet.' })
          return
        }

        setRefresh({ running: true, done: 0, total: cardIds.length, note: null })
        let done = 0
        for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
          const chunk = cardIds.slice(i, i + CHUNK_SIZE)
          await refreshChunk(chunk)
          done += chunk.length
          setRefresh({ running: true, done, total: cardIds.length, note: null })
        }

        await reload()
        setRefresh({ running: false, done, total: cardIds.length, note: 'Prices updated.' })
      } catch (e) {
        const note =
          e instanceof ProxyError && e.retryAfterSeconds
            ? `Prices were refreshed recently. Try again in ${Math.ceil(e.retryAfterSeconds / 60)} min.`
            : e instanceof Error
              ? e.message
              : 'Could not update prices.'
        // Whatever finished before the failure is already saved; the next tap resumes from scratch.
        setRefresh({ running: false, done: 0, total: 0, note })
        await reload()
      } finally {
        running.current = false
      }
    })()
  }, [userId, reload])

  const dismissNote = useCallback(() => setRefresh((r) => ({ ...r, note: null })), [])

  const value = useMemo<PortfolioValue>(
    () => ({ items, loading, error, reload, refresh, startRefresh, dismissNote }),
    [items, loading, error, reload, refresh, startRefresh, dismissNote],
  )

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
}

export function usePortfolio(): PortfolioValue {
  const value = useContext(PortfolioContext)
  if (!value) throw new Error('usePortfolio must be used inside PortfolioProvider')
  return value
}
