import { request } from './client'
import type { MediaKind, MediaUploadResult } from '@/types'

export const MAX_BYTES = 5 * 1024 * 1024

export class MediaTooLargeError extends Error {
  constructor(public sizeBytes: number) {
    super(`Le fichier doit faire moins de 5 Mo (taille actuelle : ${(sizeBytes / 1024 / 1024).toFixed(2)} Mo)`)
    this.name = 'MediaTooLargeError'
  }
}

/**
 * Uploads a file to /media. Throws MediaTooLargeError before hitting the network
 * if the file exceeds 5 MB so the user gets immediate feedback.
 */
export function upload(file: File, kind: MediaKind) {
  if (file.size > MAX_BYTES) {
    throw new MediaTooLargeError(file.size)
  }
  const form = new FormData()
  form.append('file', file)
  form.append('kind', kind)
  return request<MediaUploadResult>('/media', {
    method: 'POST',
    body: form,
  })
}
