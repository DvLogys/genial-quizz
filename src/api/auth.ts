import { request } from './client'
import type { AuthResponse, User } from '@/types'

export function register(username: string, email: string, password: string) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
}

export function login(username: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function me() {
  return request<User>('/auth/me')
}

export function deleteAccount() {
  return request<void>('/auth/me', { method: 'DELETE' })
}

export function requestPasswordReset(email: string) {
  return request<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(token: string, password: string) {
  return request<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}
