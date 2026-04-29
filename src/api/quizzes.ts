import { request } from './client'
import type { Page, QuizDetail, QuizInput, QuizSummary } from '@/types'

export interface ListMineParams {
  search?: string
  limit?: number
  offset?: number
}

export interface ListPublicParams {
  search?: string
  owner?: string
  limit?: number
  offset?: number
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === null) continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function listMine(params: ListMineParams = {}) {
  return request<Page<QuizSummary>>(
    `/quizzes${toQuery({ q: params.search, limit: params.limit, offset: params.offset })}`,
  )
}

export function listPublic(params: ListPublicParams = {}) {
  return request<Page<QuizSummary>>(
    `/quizzes/public${toQuery({
      q: params.search,
      owner: params.owner,
      limit: params.limit,
      offset: params.offset,
    })}`,
  )
}

export function listPublicOwners() {
  return request<string[]>('/quizzes/public/owners')
}

export function get(id: string) {
  return request<QuizDetail>(`/quizzes/${id}`)
}

export function create(input: QuizInput) {
  return request<QuizDetail>('/quizzes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function update(id: string, input: QuizInput) {
  return request<QuizDetail>(`/quizzes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function remove(id: string) {
  return request<void>(`/quizzes/${id}`, { method: 'DELETE' })
}
