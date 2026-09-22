import './Screen.css'

// Placeholder. The real portfolio arrives in Phase 2.
export function Portfolio() {
  return (
    <main className="screen">
      <p className="label">Portfolio value</p>
      <p className="big-number">$0.00</p>
      <p className="muted">TCGplayer market prices · Near Mint</p>

      <section className="empty">
        <h2>Your collection will show up here</h2>
        <p className="muted">Scan your first card to get started.</p>
      </section>
    </main>
  )
}
