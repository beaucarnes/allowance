import {
  ENV_FIREBASE_CLIENT_EMAIL,
  ENV_FIREBASE_PRIVATE_KEY,
  ENV_FIREBASE_PROJECT_ID,
  ENV_OWNER_UID,
  EXPECTED_FIREBASE_PROJECT_ID,
} from './constants'
import { configuredBotToken } from './auth'

export type FirebaseConfigStatus = 'ok' | 'missing' | 'mismatch'

export type WriteConfig = {
  writeReady: boolean
  ownerUid: string | null
  firebase: FirebaseConfigStatus
  missing: string[]
}

export function configuredOwnerUid(value: string | undefined): string | null {
  if (!value || !/^[A-Za-z0-9_-]{10,128}$/.test(value)) return null
  return value
}

export function firebaseConfigStatus(env: NodeJS.ProcessEnv): FirebaseConfigStatus {
  const projectId = env[ENV_FIREBASE_PROJECT_ID]
  const clientEmail = env[ENV_FIREBASE_CLIENT_EMAIL]
  const privateKey = env[ENV_FIREBASE_PRIVATE_KEY]
  if (!projectId || !clientEmail || !privateKey) return 'missing'
  if (projectId !== EXPECTED_FIREBASE_PROJECT_ID) return 'mismatch'
  if (!clientEmail.includes('@') || clientEmail.length > 320) return 'missing'
  const normalizedKey = privateKey.replace(/\\n/g, '\n')
  if (normalizedKey.length < 100 || !normalizedKey.includes('PRIVATE KEY')) return 'missing'
  return 'ok'
}

function privateKeyReady(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.replace(/\\n/g, '\n')
  return normalized.length >= 100 && normalized.includes('PRIVATE KEY')
}

/** Names only. Never returns token, uid, email, or private key material. */
export function assessWriteConfig(env: NodeJS.ProcessEnv): WriteConfig {
  const ownerUid = configuredOwnerUid(env[ENV_OWNER_UID])
  const firebase = firebaseConfigStatus(env)
  const missing: string[] = []
  if (!ownerUid) missing.push(ENV_OWNER_UID)
  if (env[ENV_FIREBASE_PROJECT_ID] !== EXPECTED_FIREBASE_PROJECT_ID) {
    missing.push(ENV_FIREBASE_PROJECT_ID)
  }
  const clientEmail = env[ENV_FIREBASE_CLIENT_EMAIL]
  if (!clientEmail || !clientEmail.includes('@') || clientEmail.length > 320) {
    missing.push(ENV_FIREBASE_CLIENT_EMAIL)
  }
  if (!privateKeyReady(env[ENV_FIREBASE_PRIVATE_KEY])) {
    missing.push(ENV_FIREBASE_PRIVATE_KEY)
  }
  return {
    writeReady: missing.length === 0 && firebase === 'ok',
    ownerUid,
    firebase,
    missing,
  }
}

export function botTokenFromEnv(env: NodeJS.ProcessEnv): string | null {
  return configuredBotToken(env.ALLOWANCE_BOT_TOKEN)
}
