export interface ImageType {
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  extension: 'png' | 'jpg' | 'webp'
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = Buffer.from([0xff, 0xd8, 0xff])

/**
 * Real type of an image from its leading bytes (docs/backend/05 §3): the file
 * name and the announced Content-Type are never trusted.
 */
export function detectImageType(content: Buffer): ImageType | null {
  if (content.subarray(0, PNG.length).equals(PNG)) {
    return { mime: 'image/png', extension: 'png' }
  }
  if (content.subarray(0, JPEG.length).equals(JPEG)) {
    return { mime: 'image/jpeg', extension: 'jpg' }
  }
  const isWebp =
    content.subarray(0, 4).toString('latin1') === 'RIFF' &&
    content.subarray(8, 12).toString('latin1') === 'WEBP'
  return isWebp ? { mime: 'image/webp', extension: 'webp' } : null
}
