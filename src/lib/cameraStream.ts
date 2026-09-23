// One camera stream, shared across visits to the camera screen.
//
// iOS does not remember camera permission for a home-screen web app, so every
// fresh launch asks again -- that part is Apple's and we cannot change it. What
// we can avoid is asking again each time you switch tabs inside one session,
// which happened because the old code stopped the stream on leaving and
// requested a brand new one on returning.
//
// So: hold the stream, hand the same one back on return, and release it when
// the app is actually done with it -- immediately on being backgrounded, or
// after a short grace period once you leave the screen.

let stream: MediaStream | null = null
let releaseTimer: ReturnType<typeof setTimeout> | undefined

/** How long the camera stays open after leaving the screen. */
const GRACE_MS = 60_000

function isLive(candidate: MediaStream | null): candidate is MediaStream {
  return Boolean(candidate) && candidate!.getVideoTracks().some((track) => track.readyState === 'live')
}

export async function acquireCamera(): Promise<MediaStream> {
  clearTimeout(releaseTimer)
  releaseTimer = undefined

  if (isLive(stream)) return stream
  // A dead stream still holds tracks; drop them before asking for another.
  releaseCameraNow()

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  })
  return stream
}

/** Leaving the camera screen: keep it warm briefly in case you come straight back. */
export function releaseCameraSoon(): void {
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(releaseCameraNow, GRACE_MS)
}

export function releaseCameraNow(): void {
  clearTimeout(releaseTimer)
  releaseTimer = undefined
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}

export function currentStream(): MediaStream | null {
  return isLive(stream) ? stream : null
}

// Put the camera down the moment the app goes to the background, so the
// recording indicator never stays lit while the app is not on screen.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseCameraNow()
  })
  window.addEventListener('pagehide', releaseCameraNow)
}
