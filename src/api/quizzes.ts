import { request } from './client'
import type { QuizDetail, QuizInput, QuizSummary } from '@/types'

export function listMine() {
  return request<QuizSummary[]>('/quizzes')
}

export function listPublic() {
  return request<QuizSummary[]>('/quizzes/public')
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
