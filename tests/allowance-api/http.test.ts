import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { entryDocument, totalUpdate, createFirestoreLedgerStore, type FirestoreDb } from '../../app/lib/allowance-api/firestore-store'
import { handleEntry, handleHealth, type HandlerDeps, type LogEvent } from '../../app/lib/allowance-api/http'
import { memoryLedger } from './memory-store'

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789'
const OWNER = 'BeauOwnerUid123456'
const EMAIL = 'ledger-admin@example.com'
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${'B'.repeat(140)}\n-----END PRIVATE KEY-----`

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ALLOWANCE_BOT_TOKEN: TOKEN,
    ALLOWANCE_OWNER_UID: OWNER,
    FIREBASE_PROJECT_ID: 'allowance-25489',
    FIREBASE_CLIENT_EMAIL: EMAIL,
    FIREBASE_PRIVATE_KEY: PRIVATE_KEY,
    ...overrides,
  }
}

function deps(overrides: Partial<HandlerDeps> = {}): { deps: HandlerDeps; logs: LogEvent[]; ledgerCalls: number } {
  const logs: LogEvent[] = []
  const ledger = memoryLedger([
    { id: 'kid-judah', slug: 'judah', parentId: OWNER, total: 84.14 },
    { id: 'kid-elon', slug: 'elon', parentId: OWNER, total: 4 },
    { id: 'kid-corwin', slug: 'corwin', parentId: OWNER, total: 6 },
  ])
  let ledgerCalls = 0
  const built: HandlerDeps = {
    env: env(),
    now: () => new Date('2026-11-08T20:00:00.000Z'),
    rateLimit: () => true,
    log: (event) => logs.push(event),
    async ledgerStore() {
      ledgerCalls += 1
      return ledger.store
    },
    ...overrides,
  }
  return { deps: built, logs, get ledgerCalls() { return ledgerCalls } }
}

function authed(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('authorization')) headers.set('authorization', `Bearer ${TOKEN}`)
  return new Request(`https://www.trackallowance.com${path}`, { ...init, headers })
}

describe('health', () => {
  it('rejects missing configuration and bad credentials without a ledger read', async () => {
    const closed = deps({ env: {} })
    const missing = await handleHealth(authed('/api/allowance/health'), closed.deps)
    assert.equal(missing.status, 503)
    assert.deepEqual(await missing.json(), { error: 'not_configured' })
    assert.equal(closed.ledgerCalls, 0)

    const wrong = deps()
    const unauthorized = await handleHealth(
      new Request('https://www.trackallowance.com/api/allowance/health'),
      wrong.deps,
    )
    assert.equal(unauthorized.status, 401)
    assert.equal(wrong.ledgerCalls, 0)
    const body = JSON.stringify(await unauthorized.json())
    assert.equal(body.includes(TOKEN), false)
  })

  it('reports scope and readiness without secrets or ledger data', async () => {
    const ready = deps()
    const response = await handleHealth(authed('/api/allowance/health'), ready.deps)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.authenticated, true)
    assert.equal(body.writeReady, true)
    assert.equal(body.firebaseProject, 'ok')
    assert.deepEqual(body.missing, [])
    assert.deepEqual(body.scope.children, ['elon', 'corwin', 'judah'])
    assert.equal(body.scope.readsLedger, false)
    assert.equal(ready.ledgerCalls, 0)
    const encoded = JSON.stringify(body)
    assert.equal(encoded.includes(TOKEN), false)
    assert.equal(encoded.includes(PRIVATE_KEY), false)
    assert.equal(encoded.includes(OWNER), false)
    assert.equal(encoded.includes('84.14'), false)
  })
})

describe('entries http', () => {
  it('validates the payload before any ledger call', async () => {
    const db = deps()
    const cases: Array<{ headers?: HeadersInit; body: unknown; status: number; field?: string }> = [
      { body: { child: 'mallory', type: 'debit', amount: '2.00', description: 'x', date: '2026-11-07' }, status: 400, field: 'child' },
      { body: { child: 'judah', type: 'transfer', amount: '2.00', description: 'x', date: '2026-11-07' }, status: 400, field: 'type' },
      { body: { child: 'judah', type: 'debit', amount: '-2.00', description: 'x', date: '2026-11-07' }, status: 400, field: 'amount' },
      { body: { child: 'judah', type: 'debit', amount: '2.001', description: 'x', date: '2026-11-07' }, status: 400, field: 'amount' },
      { body: { child: 'judah', type: 'debit', amount: '2.00', description: '', date: '2026-11-07' }, status: 400, field: 'description' },
      { body: { child: 'judah', type: 'debit', amount: '2.00', description: 'x', date: '2026-11-09' }, status: 400, field: 'date' },
      { body: { child: 'judah', type: 'debit', amount: '2.00', description: 'x', date: '2026-11-07', parentId: OWNER }, status: 400, field: 'parentId' },
    ]
    for (const item of cases) {
      const response = await handleEntry(authed('/api/allowance/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'validation-key-0001' },
        body: JSON.stringify(item.body),
      }), db.deps)
      assert.equal(response.status, item.status)
      const payload = await response.json()
      if (item.field) assert.equal(payload.field, item.field)
    }
    assert.equal(db.ledgerCalls, 0)

    const unconfigured = deps({ env: { ALLOWANCE_BOT_TOKEN: TOKEN } })
    const blocked = await handleEntry(authed('/api/allowance/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'validation-key-0002' },
      body: JSON.stringify({ child: 'Judah', type: 'debit', amount: '2.00', description: 'candy', date: '2026-11-07' }),
    }), unconfigured.deps)
    assert.equal(blocked.status, 503)
    const missing = await blocked.json()
    assert.equal(missing.error, 'not_configured')
    assert.equal(missing.missing.includes('ALLOWANCE_OWNER_UID'), true)
    assert.equal(unconfigured.ledgerCalls, 0)
  })

  it('records a debit, replays it, and hides internal failures', async () => {
    const db = deps()
    const post = (key: string, amount = '2.00', description = 'candy') => handleEntry(authed('/api/allowance/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify({
        child: 'Judah',
        type: 'debit',
        amount,
        description,
        date: '2026-11-07',
      }),
    }), db.deps)

    const created = await post('candy-november-0001')
    assert.equal(created.status, 201)
    const createdBody = await created.json()
    assert.equal(createdBody.child, 'judah')
    assert.equal(createdBody.total, '82.14')
    assert.equal(createdBody.signedAmount, -2)
    assert.equal(createdBody.idempotentReplay, false)
    assert.equal(JSON.stringify(createdBody).includes(OWNER), false)

    const replay = await post('candy-november-0001')
    assert.equal(replay.status, 200)
    const replayBody = await replay.json()
    assert.equal(replayBody.idempotentReplay, true)
    assert.equal(replayBody.total, '82.14')
    assert.equal(replayBody.id, createdBody.id)

    const conflict = await post('candy-november-0001', '3.00', 'other')
    assert.equal(conflict.status, 409)
    assert.equal((await conflict.json()).error, 'idempotency_conflict')

    const exploded = deps({
      async ledgerStore() {
        throw new Error(`private ${PRIVATE_KEY}`)
      },
    })
    const internal = await handleEntry(authed('/api/allowance/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'candy-november-0002' },
      body: JSON.stringify({ child: 'corwin', type: 'credit', amount: '1.00', description: 'gift', date: '2026-11-07' }),
    }), exploded.deps)
    assert.equal(internal.status, 500)
    const internalBody = await internal.json()
    assert.deepEqual(internalBody, { error: 'internal_error' })
    assert.equal(JSON.stringify(exploded.logs).includes(PRIVATE_KEY), false)
    assert.equal(JSON.stringify(db.logs).includes(TOKEN), false)
  })

  it('rate limits and rejects the credential inside the ledger description', async () => {
    let now = 1_000
    const limited = deps({
      now: () => new Date(now),
      rateLimit: createLimiter(),
    })
    const call = () => handleHealth(authed('/api/allowance/health'), limited.deps)
    assert.equal((await call()).status, 200)
    assert.equal((await call()).status, 200)
    assert.equal((await call()).status, 429)

    const secretInText = deps()
    const response = await handleEntry(authed('/api/allowance/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': TOKEN },
      body: JSON.stringify({ child: 'elon', type: 'credit', amount: '1.00', description: `note ${TOKEN}`, date: '2026-11-07' }),
    }), secretInText.deps)
    assert.equal(response.status, 400)
    assert.equal(secretInText.ledgerCalls, 0)
  })
})

function createLimiter() {
  const hits: number[] = []
  return (value: number) => {
    if (hits.length >= 2) return false
    hits.push(value)
    return true
  }
}

describe('firestore adapter', () => {
  it('queries by slug, then writes the entry and balance in one transaction', async () => {
    const fake = fakeFirestore([
      { id: 'kid-judah', slug: 'judah', parentId: OWNER, total: 84.14 },
      { id: 'other-judah', slug: 'judah', parentId: 'SomeoneElseUid1234', total: 9 },
    ])
    const store = createFirestoreLedgerStore(fake.db, {
      increment: (amount) => ({ op: 'increment', amount }),
      timestamp: (date) => date.toISOString(),
    })
    const { recordAllowanceEntry } = await import('../../app/lib/allowance-api/ledger')
    const result = await recordAllowanceEntry(store, {
      child: 'judah',
      type: 'debit',
      amountCents: 200,
      description: 'candy',
      calendarDate: '2026-11-07',
      date: new Date('2026-11-07T12:00:00.000Z'),
      idempotencyKey: 'adapter-key-000001',
      ownerUid: OWNER,
    })
    assert.equal(result.total, '82.14')
    assert.deepEqual(fake.filters, [{ field: 'slug', op: '==', value: 'judah' }])
    assert.equal(fake.limit, 10)
    assert.equal(fake.kids.get('kid-judah')?.total, 82.14)
    assert.equal(fake.kids.get('other-judah')?.total, 9)
    const entry = Array.from(fake.entries.values())[0]
    assert.equal(entry.amount, -2)
    assert.equal(entry.date, '2026-11-07T12:00:00.000Z')
    assert.equal(entry.parentName, 'Grok Bot')
    assert.equal(entry.source, 'allowance-bot-api')
    assert.deepEqual(Object.keys(entry).sort(), [
      'amount',
      'calendarDate',
      'date',
      'description',
      'parentEmail',
      'parentName',
      'requestHash',
      'source',
    ])
    assert.equal('parentId' in entry, false)
    assert.equal('sharedWith' in entry, false)
  })

  it('builds documents that cannot change ownership or settings', () => {
    const document = entryDocument({
      amount: -2,
      description: 'candy',
      calendarDate: '2026-11-07',
      date: new Date('2026-11-07T12:00:00.000Z'),
      requestHash: 'abc',
    }, 'timestamp')
    assert.deepEqual(Object.keys(document).sort(), [
      'amount',
      'calendarDate',
      'date',
      'description',
      'parentEmail',
      'parentName',
      'requestHash',
      'source',
    ])
    assert.deepEqual(totalUpdate(-2, (amount) => ({ op: 'increment', amount })), {
      total: { op: 'increment', amount: -2 },
    })
  })
})

type FakeKid = { id: string; slug: string; parentId: string; total: number }

function fakeFirestore(initial: FakeKid[]) {
  const kids = new Map<string, FakeKid>(initial.map((kid) => [kid.id, { ...kid }]))
  const entries = new Map<string, Record<string, unknown>>()
  const filters: Array<{ field: string; op: string; value: string }> = []
  let limit = 0

  function kidDoc(id: string) {
    return {
      kind: 'doc' as const,
      collectionName: 'kids',
      id,
      parentKidId: null as string | null,
      collection(name: string) {
        return {
          kind: 'col' as const,
          name,
          parentKidId: id,
          filters: [] as Array<{ field: string; op: string; value: string }>,
          limit: Infinity,
          where(field: string, op: string, value: string) {
            return this
          },
          limitFn(count: number) {
            return this
          },
          doc(entryId: string) {
            return { kind: 'doc' as const, collectionName: name, id: entryId, parentKidId: id }
          },
        }
      },
    }
  }

  const db = {
    collection(name: string) {
      return {
        kind: 'col' as const,
        name,
        parentKidId: null as string | null,
        filters: [] as Array<{ field: string; op: string; value: string }>,
        limitN: Infinity,
        where(field: string, op: string, value: string) {
          const next = { ...this, filters: [...this.filters, { field, op, value }] }
          next.where = this.where
          next.limit = this.limit
          next.doc = this.doc
          return next
        },
        limit(count: number) {
          const next = { ...this, limitN: count }
          next.where = this.where
          next.limit = this.limit
          next.doc = this.doc
          return next
        },
        doc(id: string) {
          return kidDoc(id)
        },
      }
    },
    async runTransaction<T>(fn: (tx: {
      get(target: { kind: string; name?: string; filters?: Array<{ field: string; op: string; value: string }>; limitN?: number; collectionName?: string; id?: string; parentKidId?: string | null }): Promise<unknown>
      set(ref: { parentKidId: string | null; id: string }, data: Record<string, unknown>): void
      update(ref: { id: string }, data: { total?: { op: string; amount: number } }): void
    }) => Promise<T>): Promise<T> {
      const staged: Array<() => void> = []
      const tx = {
        async get(target: { kind: string; filters?: Array<{ field: string; op: string; value: string }>; limitN?: number; collectionName?: string; id?: string; parentKidId?: string | null }) {
          if (target.kind === 'col') {
            filters.splice(0, filters.length, ...(target.filters ?? []))
            limit = target.limitN ?? 0
            let rows = Array.from(kids.values())
            for (const filter of target.filters ?? []) {
              if (filter.op === '==') {
                rows = rows.filter((row) => (row as Record<string, unknown>)[filter.field] === filter.value)
              }
            }
            rows = rows.slice(0, target.limitN)
            return {
              size: rows.length,
              docs: rows.map((row) => ({
                id: row.id,
                exists: true,
                get(field: string) {
                  return (row as Record<string, unknown>)[field]
                },
              })),
            }
          }
          const key = `${target.parentKidId}/${target.id}`
          const data = entries.get(key)
          return {
            id: target.id,
            exists: Boolean(data),
            get(field: string) {
              return data?.[field]
            },
          }
        },
        set(ref: { parentKidId: string | null; id: string }, data: Record<string, unknown>) {
          staged.push(() => entries.set(`${ref.parentKidId}/${ref.id}`, data))
        },
        update(ref: { id: string }, data: { total?: { op: string; amount: number } }) {
          staged.push(() => {
            const kid = kids.get(ref.id)
            if (!kid || data.total?.op !== 'increment') throw new Error('unexpected update')
            kid.total = Number((kid.total + data.total.amount).toFixed(2))
          })
        },
      }
      const result = await fn(tx)
      for (const apply of staged) apply()
      return result
    },
  }

  return { db: db as unknown as FirestoreDb, filters, get limit() { return limit }, kids, entries }
}
