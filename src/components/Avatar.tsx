import './Avatar.css'

/**
 * Each person gets a colour derived from their username, so the same friend
 * always looks the same without storing anything. Your own avatar uses the
 * app's accent instead, which keeps "me" distinct from "everyone else".
 */
export function Avatar({ username, mine = false }: { username: string; mine?: boolean }) {
  const style = mine ? undefined : { background: tintFor(username, 22), color: tintFor(username, 78) }
  return (
    <span className={`avatar${mine ? ' avatar-mine' : ''}`} style={style} aria-hidden="true">
      {username.charAt(0).toUpperCase()}
    </span>
  )
}

function tintFor(username: string, lightness: number): string {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) % 360
  return `hsl(${hash} 55% ${lightness}%)`
}
