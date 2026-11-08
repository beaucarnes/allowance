import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getBotFirestore } from './admin'
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './constants'
import { createFirestoreLedgerStore, type FirestoreDb } from './firestore-store'
import { handleHistory, type HistoryDeps } from './history-http'
import { createFirestoreHistorySource, type HistoryDb } from './history-store'
import { timestampToDate } from './history-time'
import { handleEntry, handleHealth, logAllowanceEvent, type HandlerDeps } from './http'
import { createRateLimiter } from './rate-limit'

/**
 * Server-only environment contract. Do not prefix these with NEXT_PUBLIC_.
 *
 * ALLOWANCE_BOT_TOKEN
 *   Dedicated bearer secret, at least 32 characters, no whitespace.
 * ALLOWANCE_OWNER_UID
 *   Firebase Auth uid of the parent who owns Elon, Corwin, and Judah.
 *   This is the kids' parentId. It is not a service-account key.
 * FIREBASE_PROJECT_ID
 *   Must be allowance-25489.
 * FIREBASE_CLIENT_EMAIL
 * FIREBASE_PRIVATE_KEY
 *   Already used by this app's server. They stay on the host.
 *   The bot never receives them.
 */
const rateLimit = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)

export function productionDeps(): HandlerDeps {
  return {
    env: process.env,
    now: () => new Date(),
    rateLimit,
    log: logAllowanceEvent,
    async ledgerStore() {
      const db = getBotFirestore() as unknown as FirestoreDb
      return createFirestoreLedgerStore(db, {
        increment: (amount) => FieldValue.increment(amount),
        timestamp: (date) => Timestamp.fromDate(date),
      })
    },
  }
}

export function GET(request: Request) {
  return handleHealth(request, productionDeps())
}

export function POST(request: Request) {
  return handleEntry(request, productionDeps())
}

export function getHistory(request: Request) {
  const deps: HistoryDeps = {
    env: process.env,
    now: () => new Date(),
    rateLimit,
    log: logAllowanceEvent,
    async historySource() {
      const db = getBotFirestore() as unknown as HistoryDb
      return createFirestoreHistorySource(db, {
        toTimestamp: (date) => Timestamp.fromDate(date),
        fromTimestamp: timestampToDate,
      })
    },
  }
  return handleHistory(request, deps)
}
