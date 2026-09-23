// Turning a camera frame or a chosen photo into something small enough to send.

/** Claude sees no more detail above this, and smaller uploads are faster on mobile data. */
const MAX_EDGE = 1568
/** The Edge Function refuses anything larger. */
const MAX_BYTES = 1_500_000

export type CapturedImage = { base64: string; bytes: number; width: number; height: number }

/**
 * Crops a video frame to the on-screen guide rectangle.
 *
 * The video is displayed with `object-fit: cover`, so it is scaled up and
 * centre-cropped to fill its box. To crop what the person actually framed we
 * have to undo that: work out the scale, then map the guide rectangle back into
 * the video's own pixels.
 */
export async function captureFromVideo(
  video: HTMLVideoElement,
  guide: DOMRect,
  container: DOMRect,
): Promise<CapturedImage> {
  const scale = Math.max(container.width / video.videoWidth, container.height / video.videoHeight)
  const offsetX = (video.videoWidth * scale - container.width) / 2
  const offsetY = (video.videoHeight * scale - container.height) / 2

  const sx = (guide.left - container.left + offsetX) / scale
  const sy = (guide.top - container.top + offsetY) / scale
  const sw = guide.width / scale
  const sh = guide.height / scale

  return await drawAndEncode((ctx, w, h) => ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h), sw, sh)
}

/** A photo from the library is used whole: we cannot know how it was framed. */
export async function captureFromFile(file: File): Promise<CapturedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    return await drawAndEncode(
      (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, w, h),
      bitmap.width,
      bitmap.height,
    )
  } finally {
    bitmap.close()
  }
}

async function drawAndEncode(
  paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  sourceWidth: number,
  sourceHeight: number,
): Promise<CapturedImage> {
  const shrink = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * shrink))
  const height = Math.max(1, Math.round(sourceHeight * shrink))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process the photo.')
  paint(ctx, width, height)

  // Step the quality down until it fits. Card text stays readable well below 1.0.
  for (const quality of [0.85, 0.75, 0.62, 0.5]) {
    const blob = await toBlob(canvas, quality)
    if (blob && blob.size <= MAX_BYTES) {
      return { base64: await toBase64(blob), bytes: blob.size, width, height }
    }
  }
  throw new Error('That photo would not compress small enough. Try again.')
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the photo.'))
    // The result is a data URL; the API wants only the part after the comma.
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.readAsDataURL(blob)
  })
}
