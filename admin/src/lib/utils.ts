import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatTime(d: string): string {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
