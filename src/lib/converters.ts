import type { Format } from './formats'

export interface ConversionResult {
  blob: Blob
  url: string
  filename: string
}

/**
 * Convert an image File to the target format using the Canvas API.
 * quality: 1–100 (used for lossy formats; lossless formats ignore it)
 */
export async function convertImage(
  file: File,
  target: Format,
  quality: number,
): Promise<ConversionResult> {
  const bitmap = await createImageBitmap(file)

  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas 2D context')

  // For JPEG, fill with white background (no transparency support)
  if (target.mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const canvasQuality = target.lossy ? quality / 100 : undefined

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error(`Canvas failed to produce a ${target.label} blob`))
      },
      target.mime,
      canvasQuality,
    )
  })

  const baseName = file.name.replace(/\.[^.]+$/, '')
  const filename = `${baseName}.${target.ext}`
  const url = URL.createObjectURL(blob)

  return { blob, url, filename }
}

/** Run tasks with limited concurrency */
export async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  limit: number,
): Promise<void> {
  const queue = [...tasks]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()
      if (task) await task()
    }
  })
  await Promise.all(workers)
}
