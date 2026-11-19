import { detectImageType } from '#shared/utils/image_signature'

export interface DocumentType {
  mime: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp'
  extension: 'pdf' | 'png' | 'jpg' | 'webp'
}

const PDF = Buffer.from('%PDF-', 'latin1')

/**
 * Real type of an uploaded document from its leading bytes (docs/backend/05 §3):
 * PDF, PNG, JPEG or WebP, never from the name or the announced Content-Type.
 */
export function detectDocumentType(content: Buffer): DocumentType | null {
  if (content.subarray(0, PDF.length).equals(PDF)) {
    return { mime: 'application/pdf', extension: 'pdf' }
  }
  return detectImageType(content)
}
