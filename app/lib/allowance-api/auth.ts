import { createHash, timingSafeEqual } from 'node:crypto'
import { MIN_BOT_TOKEN_LENGTH } from './constants'

/** SHA-256 both sides so the comparison does not leak the secret's length. */
export function secretsEqual(presented: string, expected: string): boolean {
  const left = createHash('sha256').update(presented, 'utf8').digest()
  const right = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(left, right)
}

/**
 * Absent, short, or whitespace-containing tokens are treated as not configured.
 * Callers must fail closed rather than compare against an empty secret.
 */
export function configuredBotToken(value: string | undefined): string | null {
  if (!value || value.length < MIN_BOT_TOKEN_LENGTH || /\s/.test(value)) return null
  return value
}

/** Returns the bearer token, or an empty string when the header is unusable. */
export function presentedBearer(authorization: string | null): string {
  if (!authorization) return ''
  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1].length === 0) return ''
  return parts[1]
}

export function bearerAuthorized(authorization: string | null, expectedToken: string): boolean {
  return secretsEqual(presentedBearer(authorization), expectedToken)
}
