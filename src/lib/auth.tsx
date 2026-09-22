import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db, type Profile } from './supabase'

type AuthValue = {
  session: Session | null
  profile: Profile | null
  /** True until we know whether someone is signed in. */
  loading: boolean
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }
    // maybeSingle: a signed-in person may not have picked a username yet.
    const { data } = await db().from('profiles').select('id, username, created_at').eq('id', userId).maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let active = true

    db()
      .auth.getSession()
      .then(async ({ data }) => {
        if (!active) return
        setSession(data.session)
        await loadProfile(data.session?.user.id)
        if (active) setLoading(false)
      })

    const { data: sub } = db().auth.onAuthStateChange((_event, next) => {
      setSession(next)
      void loadProfile(next?.user.id)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthValue>(
    () => ({ session, profile, loading, reloadProfile: () => loadProfile(session?.user.id) }),
    [session, profile, loading, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

export async function signOut() {
  await db().auth.signOut()
}
