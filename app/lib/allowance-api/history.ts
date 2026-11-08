import { ALLOWED_CHILDREN, HISTORY_MAX_SCAN, KID_LOOKUP_LIMIT, type AllowedChild } from './constants'
import { AllowanceError } from './errors'
import type { KidLookup } from './ledger'

export type HistoryType = 'all' | 'debit' | 'credit'

export type HistoryResume =
  | { kind: 'start' }
  | { kind: 'after-id'; ms: number; id: string }
  | { kind: 'after-time'; ms: number }
  | { kind: 'from-time'; ms: number }

export type HistoryRecord = {
  id: string
  child: AllowedChild
  amount: number
  description: string | null
  timestamp: Date
}

export type HistoryCursor = {
  ms: number
  child: AllowedChild
  id: string
}

export interface HistorySource {
  findKidsBySlug(slug: string): Promise<KidLookup>
  readTransactions(input: {
    kidId: string
    child: AllowedChild
    startMs: number
    endMs: number
    resume: HistoryResume
    limit: number
  }): Promise<HistoryRecord[]>
}

export function exactSignedDecimal(amount: number): string {
  if (!Number.isFinite(amount)) throw new AllowanceError('invalid_stored_entry', 500)
  const negative = amount < 0
  const absolute = Math.abs(amount)
  let text = absolute.toString()
  if (/[eE]/.test(text)) text = absolute.toFixed(20).replace(/0+$/, '').replace(/\.$/, '')
  if (!text.includes('.')) text = `${text}.00`
  else if (text.split('.')[1].length === 1) text = `${text}0`
  return negative ? `-${text}` : text
}

export function compareHistory(a: HistoryRecord, b: HistoryRecord): number {
  const left = a.timestamp.getTime()
  const right = b.timestamp.getTime()
  if (left !== right) return left - right
  if (a.child !== b.child) return a.child < b.child ? -1 : 1
  if (a.id !== b.id) return a.id < b.id ? -1 : 1
  return 0
}

function resumeFor(child: AllowedChild, cursor: HistoryCursor | null): HistoryResume {
  if (!cursor) return { kind: 'start' }
  if (child === cursor.child) return { kind: 'after-id', ms: cursor.ms, id: cursor.id }
  if (child > cursor.child) return { kind: 'from-time', ms: cursor.ms }
  return { kind: 'after-time', ms: cursor.ms }
}

function matches(record: HistoryRecord, type: HistoryType): boolean {
  if (!Number.isFinite(record.amount)) return false
  if (type === 'all') return true
  if (type === 'debit') return record.amount < 0
  return record.amount > 0
}

async function ownedKidId(source: HistorySource, child: AllowedChild, ownerUid: string): Promise<string> {
  const lookup = await source.findKidsBySlug(child)
  const owned = lookup.kids.filter((kid) => kid.slug === child && kid.parentId === ownerUid)
  if (lookup.scanned >= lookup.limit || owned.length > 1) {
    throw new AllowanceError('ambiguous_child', 409)
  }
  if (owned.length === 0) throw new AllowanceError('child_not_found', 404)
  return owned[0].id
}

type Stream = {
  child: AllowedChild
  kidId: string
  buffer: HistoryRecord[]
  exhausted: boolean
  resume: HistoryResume
}

export async function readHistoryPage(input: {
  source: HistorySource
  ownerUid: string
  children: readonly AllowedChild[]
  startMs: number
  endMs: number
  type: HistoryType
  limit: number
  cursor: HistoryCursor | null
  maxScan?: number
}): Promise<{ records: HistoryRecord[]; cursor: HistoryCursor | null; complete: boolean }> {
  const maxScan = input.maxScan ?? HISTORY_MAX_SCAN
  const streams: Stream[] = []
  for (const child of input.children) {
    streams.push({
      child,
      kidId: await ownedKidId(input.source, child, input.ownerUid),
      buffer: [],
      exhausted: false,
      resume: resumeFor(child, input.cursor),
    })
  }

  let scanned = 0
  const records: HistoryRecord[] = []
  let last: HistoryRecord | null = null

  const fill = async (stream: Stream) => {
    if (stream.buffer.length > 0 || stream.exhausted || scanned >= maxScan) return
    const batchSize = Math.min(20, maxScan - scanned)
    const batch = await input.source.readTransactions({
      kidId: stream.kidId,
      child: stream.child,
      startMs: input.startMs,
      endMs: input.endMs,
      resume: stream.resume,
      limit: batchSize,
    })
    scanned += batch.length
    batch.sort(compareHistory)
    if (batch.length < batchSize) stream.exhausted = true
    stream.buffer = batch
  }

  while (records.length < input.limit) {
    for (const stream of streams) await fill(stream)
    const blocked = streams.some((stream) => stream.buffer.length === 0 && !stream.exhausted)
    const ready = streams.filter((stream) => stream.buffer.length > 0)
    if (ready.length === 0) {
      return { records, cursor: blocked && last ? toCursor(last) : null, complete: !blocked }
    }
    if (blocked) {
      return { records, cursor: last ? toCursor(last) : null, complete: last === null }
    }
    ready.sort((left, right) => compareHistory(left.buffer[0], right.buffer[0]))
    const stream = ready[0]
    const next = stream.buffer.shift()
    if (!next) break
    stream.resume = { kind: 'after-id', ms: next.timestamp.getTime(), id: next.id }
    last = next
    if (matches(next, input.type)) records.push(next)
  }

  const more = streams.some((stream) => stream.buffer.length > 0 || !stream.exhausted)
  return {
    records,
    cursor: more && last ? toCursor(last) : null,
    complete: !more,
  }
}

function toCursor(record: HistoryRecord): HistoryCursor {
  return { ms: record.timestamp.getTime(), child: record.child, id: record.id }
}

export function childrenForScope(scope: AllowedChild | 'all'): readonly AllowedChild[] {
  return scope === 'all' ? ALLOWED_CHILDREN : [scope]
}

export { KID_LOOKUP_LIMIT }
