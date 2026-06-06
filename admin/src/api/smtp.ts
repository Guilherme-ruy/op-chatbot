import { api } from './client'
import type { SmtpSettingsPublic, SmtpSettingsInput } from '@/types/admin'

export async function getSmtpSettings(): Promise<SmtpSettingsPublic | null> {
  const { data } = await api.get<SmtpSettingsPublic | null>('/smtp')
  return data
}

export async function saveSmtpSettings(settings: SmtpSettingsInput): Promise<SmtpSettingsPublic> {
  const { data } = await api.patch<SmtpSettingsPublic>('/smtp', settings)
  return data
}

export async function testSmtpConnection(): Promise<void> {
  await api.post('/smtp/test')
}
