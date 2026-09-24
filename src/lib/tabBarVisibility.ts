import { useSyncExternalStore } from 'react'

// The camera needs the whole screen: with the tab bar in place its controls sit
// underneath it. This is app-wide interface state rather than data, so it lives
// in a tiny store outside React and the tab bar simply subscribes.

let hidden = false
const listeners = new Set<() => void>()

export function setTabBarHidden(next: boolean): void {
  if (hidden === next) return
  hidden = next
  listeners.forEach((notify) => notify())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function read(): boolean {
  return hidden
}

export function useTabBarHidden(): boolean {
  return useSyncExternalStore(subscribe, read, read)
}
