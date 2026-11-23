import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { AppException } from '#shared/exceptions/app_exception'
import fileStorage, { type CheckedUpload } from '#shared/files/file_storage'
import {
  detectApplicationDocument,
  type ApplicationDocumentType,
} from '#shared/utils/application_document'
import type { RequiredDocument } from '#models/job'

/** 2 MB per application file (00-HANDOFF §4). */
export const MAX_APPLICATION_FILE_BYTES = 2 * 1024 * 1024

/** Keys of the fixed pieces; the offer's own keys come from `required_documents`. */
export const CV_KEY = 'cv'
export const COVER_LETTER_KEY = 'cover_letter'

export interface ApplicationUploads {
  cv?: MultipartFile
  coverLetter?: MultipartFile
  documents?: Record<string, MultipartFile>
}

export interface StoredPiece {
  key: string
  path: string
  row: Awaited<ReturnType<typeof fileStorage.put>>
}

type Checked = { key: string; upload: CheckedUpload<ApplicationDocumentType> }

/**
 * Pieces of an application (06 §11, 08 §6): the requested documents of the
 * offer, each at most 2 MB, real type PDF, DOC, DOCX, JPG or PNG, stored in the
 * private space under `<org>/candidate/<candidateId>/`.
 */
export class CandidateFiles {
  /** Every required piece is present and no unknown key is sent (07 §4.3). */
  assertComplete(uploads: ApplicationUploads, required: RequiredDocument[], cvRequired: boolean) {
    if (cvRequired && !uploads.cv) {
      throw AppException.validation('cv', 'required', 'validation.recruitment.cvRequired')
    }
    const known = new Set(required.map((document) => document.key))
    for (const key of Object.keys(uploads.documents ?? {})) {
      if (!known.has(key)) {
        throw AppException.validation(
          `documents.${key}`,
          'unknown',
          'validation.recruitment.documentUnknown'
        )
      }
    }
    for (const document of required) {
      if (document.required && !uploads.documents?.[document.key]) {
        throw AppException.validation(
          `documents.${document.key}`,
          'required',
          'validation.recruitment.documentRequired'
        )
      }
    }
  }

  /** Size and real type of each piece, before anything is stored. */
  async check(uploads: ApplicationUploads): Promise<Checked[]> {
    const pieces: Array<[string, MultipartFile]> = []
    if (uploads.cv) pieces.push([CV_KEY, uploads.cv])
    if (uploads.coverLetter) pieces.push([COVER_LETTER_KEY, uploads.coverLetter])
    for (const [key, file] of Object.entries(uploads.documents ?? {})) pieces.push([key, file])
    const checked: Checked[] = []
    for (const [key, file] of pieces) {
      const field = key === CV_KEY || key === COVER_LETTER_KEY ? key : `documents.${key}`
      const upload = await fileStorage.check(
        file,
        MAX_APPLICATION_FILE_BYTES,
        detectApplicationDocument,
        () => AppException.validation(field, 'documentType', 'validation.recruitment.documentType')
      )
      checked.push({ key, upload })
    }
    return checked
  }

  /** Writes the checked pieces; a failure removes what was already written. */
  async store(organizationId: string, candidateId: string, checked: Checked[]) {
    const stored: StoredPiece[] = []
    try {
      for (const { key, upload } of checked) {
        const path = fileStorage.key(
          organizationId,
          'candidate',
          candidateId,
          upload.type.extension
        )
        stored.push({ key, path, row: await fileStorage.put('private', path, upload) })
      }
    } catch (error) {
      await this.discard(stored.map((piece) => piece.path))
      throw error
    }
    return stored
  }

  async discard(paths: string[]) {
    for (const path of paths) await fileStorage.deleteQuietly('private', path)
  }

  /** Column values of a candidate from its stored pieces. */
  columns(stored: StoredPiece[]) {
    const documents: Record<string, string> = {}
    let cvPath: string | null = null
    let coverLetterPath: string | null = null
    for (const piece of stored) {
      if (piece.key === CV_KEY) cvPath = piece.path
      else if (piece.key === COVER_LETTER_KEY) coverLetterPath = piece.path
      else documents[piece.key] = piece.path
    }
    return { cvPath, coverLetterPath, documents }
  }
}

export default new CandidateFiles()
