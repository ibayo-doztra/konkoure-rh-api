import { detectImageType } from '#shared/utils/image_signature'

export interface ApplicationDocumentType {
  mime:
    | 'application/pdf'
    | 'application/msword'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'image/png'
    | 'image/jpeg'
  extension: 'pdf' | 'doc' | 'docx' | 'png' | 'jpg'
}

const PDF = Buffer.from('%PDF-', 'latin1')
/** OLE2 compound file, the container of legacy Word documents. */
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/**
 * Real type of an application document (00-HANDOFF §4: PDF, DOC, DOCX, JPG,
 * PNG) from its bytes, never from its name or announced Content-Type. A DOCX
 * is a ZIP archive whose entries include the `word/` part.
 */
export function detectApplicationDocument(content: Buffer): ApplicationDocumentType | null {
  if (content.subarray(0, PDF.length).equals(PDF)) {
    return { mime: 'application/pdf', extension: 'pdf' }
  }
  if (content.subarray(0, OLE2.length).equals(OLE2)) {
    return { mime: 'application/msword', extension: 'doc' }
  }
  if (content.subarray(0, ZIP.length).equals(ZIP)) {
    return content.includes('word/document.xml', 0, 'latin1')
      ? {
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extension: 'docx',
        }
      : null
  }
  const image = detectImageType(content)
  if (image?.extension === 'png' || image?.extension === 'jpg') {
    return image as ApplicationDocumentType
  }
  return null
}
