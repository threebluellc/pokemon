import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmCard } from '../components/ConfirmCard'
import { BoltIcon, CloseIcon, LibraryIcon, StackIcon } from '../components/Icons'
import { identifyCard, ProxyError } from '../lib/api'
import { acquireCamera, currentStream, releaseCameraSoon } from '../lib/cameraStream'
import { captureFromFile, captureFromVideo } from '../lib/image'
import { setTabBarHidden } from '../lib/tabBarVisibility'
import type { CachedCard } from '../lib/types'
import { usePortfolio } from '../lib/usePortfolio'
import '../components/Form.css'
import './Camera.css'
import './Screen.css'

type Stage =
  | { name: 'starting' }
  | { name: 'live' }
  | { name: 'blocked'; reason: string }
  | { name: 'reading' }
  | { name: 'confirm'; candidates: CachedCard[] }
  | { name: 'nomatch'; message: string }

export function Camera() {
  const navigate = useNavigate()
  const { reload } = usePortfolio()
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const [stage, setStage] = useState<Stage>(() => (currentStream() ? { name: 'live' } : { name: 'starting' }))
  const [batch, setBatch] = useState(false)
  const [added, setAdded] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [torch, setTorch] = useState<{ on: boolean } | null>(null)

  // The live view fills the screen, so the tab bar would sit on top of the
  // shutter. Confirm and the no-camera fallback are ordinary screens and keep it.
  const fullScreen = stage.name !== 'confirm' && stage.name !== 'blocked'
  // Layout effect, not a plain one: this runs before the browser paints, so the
  // tab bar never flashes into view for a frame on the way in or out.
  useLayoutEffect(() => {
    setTabBarHidden(fullScreen)
    return () => setTabBarHidden(false)
  }, [fullScreen])

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStage({ name: 'blocked', reason: 'This browser cannot open the camera.' })
        return
      }
      try {
        // Reuses the stream from a previous visit when there is one, so moving
        // between tabs does not set off another permission prompt.
        const stream = await acquireCamera()
        if (cancelled) return
        if (videoRef.current) videoRef.current.srcObject = stream

        // Torch is rare on iPhone Safari, so the button only appears where it works.
        const track = stream.getVideoTracks()[0]
        const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined
        if (capabilities?.torch) setTorch({ on: false })

        setStage({ name: 'live' })
      } catch {
        setStage({
          name: 'blocked',
          reason: 'We could not open the camera. You can still pick a photo instead.',
        })
      }
    }

    void start()
    return () => {
      cancelled = true
      releaseCameraSoon()
    }
  }, [])

  async function toggleTorch() {
    const track = currentStream()?.getVideoTracks()[0]
    if (!track || !torch) return
    const next = !torch.on
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch({ on: next })
    } catch {
      setTorch(null) // it claimed to support torch but does not; stop offering it
    }
  }

  async function identify(base64: string) {
    setStage({ name: 'reading' })
    try {
      const result = await identifyCard(base64)
      if (!result.is_pokemon_card) {
        setStage({ name: 'nomatch', message: "That does not look like a Pokémon card. Try again." })
        return
      }
      if (result.candidates.length === 0) {
        setStage({
          name: 'nomatch',
          message: result.read?.name
            ? `We read "${result.read.name}" but found no matching card. Try the manual search.`
            : 'No matching card found. Try the manual search.',
        })
        return
      }
      setStage({ name: 'confirm', candidates: result.candidates })
    } catch (e) {
      setStage({
        name: 'nomatch',
        message: e instanceof ProxyError ? e.message : 'Could not read that photo. Please try again.',
      })
    }
  }

  async function shoot() {
    const video = videoRef.current
    const frame = frameRef.current
    const container = stageRef.current
    if (!video || !frame || !container || video.videoWidth === 0) return
    try {
      const shot = await captureFromVideo(video, frame.getBoundingClientRect(), container.getBoundingClientRect())
      await identify(shot.base64)
    } catch (e) {
      setStage({ name: 'nomatch', message: e instanceof Error ? e.message : 'Could not take that photo.' })
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    setStage({ name: 'reading' })
    try {
      const shot = await captureFromFile(file)
      await identify(shot.base64)
    } catch (e) {
      setStage({ name: 'nomatch', message: e instanceof Error ? e.message : 'Could not read that photo.' })
    }
  }

  if (stage.name === 'confirm') {
    return (
      <ConfirmCard
        candidates={stage.candidates}
        fromPhoto
        onBack={() => setStage({ name: 'live' })}
        onManualSearch={() => navigate('/add')}
        onAdded={async (message) => {
          await reload()
          if (batch) {
            setAdded((n) => n + 1)
            setToast(message)
            setStage({ name: 'live' })
          } else {
            navigate('/')
          }
        }}
      />
    )
  }

  if (stage.name === 'blocked') {
    return (
      <main className="screen">
        <h1 className="title">Add a card</h1>
        <p className="muted subtitle">{stage.reason}</p>
        <p className="muted subtitle">
          If you tapped Don&apos;t Allow, open iPhone Settings, find this app under Safari, and turn the
          camera back on.
        </p>
        <label className="button-primary file-button">
          Choose a photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
        </label>
        <button type="button" className="button-link" onClick={() => navigate('/add')}>
          Or search for the card by name
        </button>
      </main>
    )
  }

  return (
    <div className="camera" ref={stageRef}>
      <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />

      <div className="camera-chrome">
        <header className="camera-head">
          {/* With the tab bar hidden this is the only way out of the camera. */}
          <button
            type="button"
            className="round-button round-button-left"
            onClick={() => navigate('/')}
            aria-label="Close the camera"
          >
            <CloseIcon />
          </button>
          <h1>Add a card</h1>
          {torch && (
            <button
              type="button"
              className={`round-button${torch.on ? ' round-button-on' : ''}`}
              onClick={() => void toggleTorch()}
              aria-label={torch.on ? 'Turn the light off' : 'Turn the light on'}
              aria-pressed={torch.on}
            >
              <BoltIcon />
            </button>
          )}
        </header>

        <p className="camera-pill">Fit the whole card inside the frame</p>

        {/* The dimming is a huge shadow cast outward from this box. */}
        <div className="guide" ref={frameRef}>
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
        </div>

        <p className="camera-caption">We read the name and number. You confirm the match.</p>

        {toast && (
          <button type="button" className="camera-toast" onClick={() => setToast(null)}>
            {toast} {added > 0 && <strong>{added} this session</strong>}
          </button>
        )}

        {stage.name === 'nomatch' && (
          <p className="camera-error" role="alert">
            {stage.message}
          </p>
        )}

        <div className="camera-controls">
          <label className="control" aria-label="Choose a photo from your library">
            <span className="control-icon">
              <LibraryIcon />
            </span>
            <span>Library</span>
            <input type="file" accept="image/*" onChange={(e) => void pickFile(e.target.files?.[0])} />
          </label>

          <button
            type="button"
            className="shutter"
            onClick={() => void shoot()}
            disabled={stage.name !== 'live' && stage.name !== 'nomatch'}
            aria-label="Take a photo of the card"
          >
            <span className="shutter-inner" />
          </button>

          <button
            type="button"
            className={`control${batch ? ' control-on' : ''}`}
            onClick={() => setBatch(!batch)}
            aria-pressed={batch}
          >
            <span className="control-icon">
              <StackIcon />
            </span>
            <span>Batch{added > 0 ? ` ${added}` : ''}</span>
          </button>
        </div>
      </div>

      {stage.name === 'reading' && (
        <div className="reading" role="status">
          <span className="spinner" aria-hidden="true" />
          Reading card…
        </div>
      )}
    </div>
  )
}
