export interface Format {
  id: string
  label: string
  ext: string
  mime: string
  lossy: boolean
}

export const OUTPUT_FORMATS: Format[] = [
  { id: 'jpeg', label: 'JPEG', ext: 'jpg', mime: 'image/jpeg', lossy: true },
  { id: 'png',  label: 'PNG',  ext: 'png', mime: 'image/png',  lossy: false },
  { id: 'webp', label: 'WebP', ext: 'webp', mime: 'image/webp', lossy: true },
  { id: 'avif', label: 'AVIF', ext: 'avif', mime: 'image/avif', lossy: true },
]

/** Check if the browser's canvas supports a given output MIME type */
export async function isFormatSupported(mime: string): Promise<boolean> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    canvas.toBlob((blob) => resolve(blob !== null && blob.type === mime), mime)
  })
}

/** Get a human-readable label for a MIME type */
export function mimeToLabel(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
    'image/avif': 'AVIF',
    'image/gif': 'GIF',
    'image/bmp': 'BMP',
    'image/tiff': 'TIFF',
    'image/svg+xml': 'SVG',
    'image/x-icon': 'ICO',
  }
  return map[mime] ?? mime.split('/')[1]?.toUpperCase() ?? 'Unknown'
}
