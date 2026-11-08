/** Firebase project this app already uses. Writes refuse any other project id. */
export const EXPECTED_FIREBASE_PROJECT_ID = 'allowance-25489'

/**
 * Slugs produced by the app's kid URL normalizer for Elon, Corwin, and Judah.
 * Ownership is still checked against parentId; a matching slug is not enough.
 */
export const ALLOWED_CHILDREN = ['elon', 'corwin', 'judah'] as const

export type AllowedChild = (typeof ALLOWED_CHILDREN)[number]

export const ENV_BOT_TOKEN = 'ALLOWANCE_BOT_TOKEN'
export const ENV_OWNER_UID = 'ALLOWANCE_OWNER_UID'
export const ENV_FIREBASE_PROJECT_ID = 'FIREBASE_PROJECT_ID'
export const ENV_FIREBASE_CLIENT_EMAIL = 'FIREBASE_CLIENT_EMAIL'
export const ENV_FIREBASE_PRIVATE_KEY = 'FIREBASE_PRIVATE_KEY'

/** Calendar "today" for rejecting future dates. */
export const LEDGER_TIME_ZONE = 'America/Los_Angeles'

/** Inclusive per-entry cap. $10,000.00. */
export const MAX_AMOUNT_CENTS = 1_000_000

export const MIN_CALENDAR_DATE = '2015-01-01'
export const MAX_DESCRIPTION_LENGTH = 200
export const MIN_BOT_TOKEN_LENGTH = 32
export const KID_LOOKUP_LIMIT = 10

export const BOT_PARENT_NAME = 'Grok Bot'
export const BOT_PARENT_EMAIL = 'grok-bot@localhost'
export const BOT_SOURCE = 'allowance-bot-api'

export const RATE_LIMIT_MAX = 60
export const RATE_LIMIT_WINDOW_MS = 60_000

export function isAllowedChild(value: string): value is AllowedChild {
  return (ALLOWED_CHILDREN as readonly string[]).includes(value)
}
