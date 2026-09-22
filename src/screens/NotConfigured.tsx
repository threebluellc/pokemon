import './Screen.css'

// Shown when the site was built without the Supabase project details. Better
// than a blank screen while the backend is still being set up.
export function NotConfigured() {
  return (
    <main className="screen screen-centered">
      <h1 className="title">Almost ready</h1>
      <p className="muted subtitle">
        This app still needs its database details. Add the Supabase URL and anon key as repository
        variables, then deploy again.
      </p>
    </main>
  )
}
