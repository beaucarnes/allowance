import { createHash } from 'node:crypto'
import { isAllowedChild, KID_LOOKUP_LIMIT, type AllowedChild } from './constants'
import { AllowanceError } from './errors'
import { addCents, centsToAmount, formatMoney, signedCents } from './money'

export type KidSnapshot = {
  id: string
  slug: string
  parentId: string
  total: number
  totalValid: boolean
}

export type StoredEntry =
  | { exists: false }
  | {
      exists: true
      amount: number
      description: string
      calendarDate: string
      requestHash: string
    }

export type EntryWrite = {
  amount: number
  description: string
  calendarDate: string
  date: Date
  requestHash: string
}

export type KidLookup = {
  kids: KidSnapshot[]
  scanned: number
  limit: number
}

export interface LedgerTx {
  findKidsBySlug(slug: string): Promise<KidLookup>
  readEntry(kidId: string, entryId: string): Promise<StoredEntry>
  createEntry(kidId: string, entryId: string, data: EntryWrite): void
  incrementTotal(kidId: string, delta: number): void
}

export interface LedgerStore {
  runTransaction<T>(fn: (tx: LedgerTx) => Promise<T>): Promise<T>
}

export type EntryRequest = {
  child: AllowedChild
  type: 'debit' | 'credit'
  amountCents: number
  description: string
  calendarDate: string
  date: Date
  idempotencyKey: string
  ownerUid: string
}

export type EntryResult = {
  id: string
  child: AllowedChild
  type: 'debit' | 'credit'
  amount: string
  signedAmount: number
  description: string
  date: string
  total: string
  idempotentReplay: boolean
}

export function entryDocumentId(ownerUid: string, child: string, idempotencyKey: string): string {
  const digest = createHash('sha256')
    .update(JSON.stringify([1, ownerUid, child, idempotencyKey]))
    .digest('hex')
  return `bot_${digest}`
}

export function entryRequestHash(input: {
  ownerUid: string
  child: string
  type: string
  amountCents: number
  description: string
  calendarDate: string
}): string {
  return createHash('sha256')
    .update(JSON.stringify([
      1,
      input.ownerUid,
      input.child,
      input.type,
      input.amountCents,
      input.calendarDate,
      input.description,
    ]))
    .digest('hex')
}

function resultFromStored(
  id: string,
  child: AllowedChild,
  stored: Extract<StoredEntry, { exists: true }>,
  total: number,
  replay: boolean,
): EntryResult {
  if (!Number.isFinite(stored.amount) || stored.amount === 0) {
    throw new AllowanceError('invalid_stored_entry', 500)
  }
  const type = stored.amount < 0 ? 'debit' : 'credit'
  return {
    id,
    child,
    type,
    amount: formatMoney(Math.abs(stored.amount)),
    signedAmount: Number(stored.amount.toFixed(2)),
    description: stored.description,
    date: stored.calendarDate,
    total: formatMoney(total),
    idempotentReplay: replay,
  }
}

export async function recordAllowanceEntry(
  store: LedgerStore,
  input: EntryRequest,
): Promise<EntryResult> {
  if (!isAllowedChild(input.child)) {
    throw new AllowanceError('invalid_request', 400, 'child')
  }
  const entryId = entryDocumentId(input.ownerUid, input.child, input.idempotencyKey)
  const requestHash = entryRequestHash(input)
  const deltaCents = signedCents(input.type, input.amountCents)
  const delta = centsToAmount(deltaCents)

  return store.runTransaction(async (tx) => {
    const lookup = await tx.findKidsBySlug(input.child)
    const owned = lookup.kids.filter(
      (kid) => kid.slug === input.child && kid.parentId === input.ownerUid,
    )
    // A full page means further slug matches may exist. Refuse rather than guess.
    if (lookup.scanned >= lookup.limit || owned.length > 1) {
      throw new AllowanceError('ambiguous_child', 409)
    }
    if (owned.length === 0) throw new AllowanceError('child_not_found', 404)
    const kid = owned[0]
    if (!kid.totalValid || !Number.isFinite(kid.total)) {
      throw new AllowanceError('invalid_kid_total', 500)
    }

    const existing = await tx.readEntry(kid.id, entryId)
    if (existing.exists) {
      if (existing.requestHash !== requestHash) {
        throw new AllowanceError('idempotency_conflict', 409)
      }
      return resultFromStored(entryId, input.child, existing, kid.total, true)
    }

    const nextTotal = addCents(kid.total, deltaCents)
    tx.createEntry(kid.id, entryId, {
      amount: delta,
      description: input.description,
      calendarDate: input.calendarDate,
      date: input.date,
      requestHash,
    })
    tx.incrementTotal(kid.id, delta)
    return {
      id: entryId,
      child: input.child,
      type: input.type,
      amount: formatMoney(centsToAmount(input.amountCents)),
      signedAmount: delta,
      description: input.description,
      date: input.calendarDate,
      total: formatMoney(nextTotal),
      idempotentReplay: false,
    }
  })
}

export { KID_LOOKUP_LIMIT }
