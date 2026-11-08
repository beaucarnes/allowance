import { KID_LOOKUP_LIMIT } from './constants'
import { AllowanceError } from './errors'
import type { HistoryRecord, HistoryResume, HistorySource } from './history'
import type { KidLookup, KidSnapshot } from './ledger'

type Query = {
  where(field: string, op: string, value: unknown): Query
  orderBy(field: unknown, direction: 'asc' | 'desc'): Query
  startAfter(...values: unknown[]): Query
  limit(count: number): Query
  get(): Promise<{ docs: DocSnap[] }>
}

type DocSnap = {
  id: string
  get(field: string): unknown
}

type Collection = {
  where(field: string, op: string, value: unknown): Query
  limit(count: number): Query
  doc(id: string): { collection(name: string): Collection }
}

export type HistoryDb = {
  collection(name: string): Collection
}

export type HistoryCodec = {
  documentId: () => unknown
  toTimestamp: (date: Date) => unknown
  fromTimestamp: (value: unknown) => Date | null
}

function kidSnapshot(id: string, get: (field: string) => unknown): KidSnapshot {
  const slug = get('slug')
  const parentId = get('parentId')
  const total = get('total')
  return {
    id,
    slug: typeof slug === 'string' ? slug : '',
    parentId: typeof parentId === 'string' ? parentId : '',
    total: typeof total === 'number' ? total : 0,
    totalValid: total === undefined || typeof total === 'number',
  }
}

function applyResume(
  query: { where(field: string, op: string, value: unknown): Query },
  resume: HistoryResume,
  codec: HistoryCodec,
  startMs: number,
  endMs: number,
): Query {
  const end = codec.toTimestamp(new Date(endMs))
  if (resume.kind === 'after-time') {
    return query.where('date', '>', codec.toTimestamp(new Date(resume.ms))).where('date', '<', end)
  }
  if (resume.kind === 'from-time') {
    return query.where('date', '>=', codec.toTimestamp(new Date(resume.ms))).where('date', '<', end)
  }
  let bounded = query
    .where('date', '>=', codec.toTimestamp(new Date(startMs)))
    .where('date', '<', end)
  if (resume.kind === 'after-id') {
    bounded = bounded.startAfter(codec.toTimestamp(new Date(resume.ms)), resume.id)
  }
  return bounded
}

export function createFirestoreHistorySource(db: HistoryDb, codec: HistoryCodec): HistorySource {
  const kids = db.collection('kids')
  return {
    async findKidsBySlug(slug): Promise<KidLookup> {
      const snap = await kids.where('slug', '==', slug).limit(KID_LOOKUP_LIMIT).get()
      return {
        kids: snap.docs.map((doc) => kidSnapshot(doc.id, (field) => doc.get(field))),
        scanned: snap.docs.length,
        limit: KID_LOOKUP_LIMIT,
      }
    },
    async readTransactions({ kidId, child, startMs, endMs, resume, limit }): Promise<HistoryRecord[]> {
      const query = applyResume(kids.doc(kidId).collection('transactions'), resume, codec, startMs, endMs)
        .orderBy('date', 'asc')
        .orderBy(codec.documentId(), 'asc')
        .limit(limit)
      const snap = await query.get()
      return snap.docs.map((doc) => {
        const timestamp = codec.fromTimestamp(doc.get('date'))
        if (!timestamp || !Number.isFinite(timestamp.getTime())) {
          throw new AllowanceError('invalid_stored_entry', 500)
        }
        const amount = doc.get('amount')
        const description = doc.get('description')
        return {
          id: doc.id,
          child,
          amount: typeof amount === 'number' ? amount : Number.NaN,
          description: typeof description === 'string' ? description : null,
          timestamp,
        }
      })
    },
  }
}
