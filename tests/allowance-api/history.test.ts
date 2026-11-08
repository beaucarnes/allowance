import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AllowanceError } from '../../app/lib/allowance-api/errors'
import {
  exactSignedDecimal,
  readHistoryPage,
  type HistoryCursor,
  type HistoryRecord,
  type HistorySource,
} from '../../app/lib/allowance-api/history'
import { handleHistory, type HistoryDeps } from '../../app/lib/allowance-api/history-http'
import {
  calendarDateInNy,
  historyWindow,
  nyMidnightUtc,
} from '../../app/lib/allowance-api/history-time'
import { createFirestoreHistorySource, type HistoryDb } from '../../app/lib/allowance-api/history-store'
import type { LogEvent } from '../../app/lib/allowance-api/http'
import type { AllowedChild } from '../../app/lib/allowance-api/constants'

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789'
const OWNER = 'BeauOwnerUid123456'
const OTHER = 'SomeoneElseUid1234'
const EMAIL = 'ledger-admin@example.com'
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${'C'.repeat(140)}\n-----END PRIVATE KEY-----`

type Row = {
  id: string
  child: AllowedChild
  kidId: string
  amount: number
  description: string | null
  timestamp: Date
}

function memorySource(kids: { id: string; slug: string; parentId: string }[], rows: Row[]) {
  let reads = 0
  const source: HistorySource = {
    async findKidsBySlug(slug) {
      const matched = kids.filter((kid) => kid.slug === slug).slice(0, 10)
      return {
        kids: matched.map((kid) => ({ ...kid, total: 0, totalValid: true })),
        scanned: matched.length,
        limit: 10,
      }
    },
    async readTransactions(input) {
      reads += 1
      const resume = input.resume
      let selected = rows.filter((row) =>
        row.kidId === input.kidId &&
        row.timestamp.getTime() >= input.startMs &&
        row.timestamp.getTime() < input.endMs)
      selected.sort((left, right) =>
        left.timestamp.getTime() - right.timestamp.getTime() || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      if (resume.kind === 'after-id') {
        selected = selected.filter((row) =>
          row.timestamp.getTime() > resume.ms ||
          (row.timestamp.getTime() === resume.ms && row.id > resume.id))
      } else if (resume.kind === 'after-time') {
        selected = selected.filter((row) => row.timestamp.getTime() > resume.ms)
      } else if (resume.kind === 'from-time') {
        selected = selected.filter((row) => row.timestamp.getTime() >= resume.ms)
      }
      return selected.slice(0, input.limit).map((row): HistoryRecord => ({
        id: row.id,
        child: input.child,
        amount: row.amount,
        description: row.description,
        timestamp: row.timestamp,
      }))
    },
  }
  return { source, get reads() { return reads } }
}

const ownedKids = [
  { id: 'kid-elon', slug: 'elon', parentId: OWNER },
  { id: 'kid-corwin', slug: 'corwin', parentId: OWNER },
  { id: 'kid-judah', slug: 'judah', parentId: OWNER },
]

function at(iso: string): Date {
  return new Date(iso)
}

describe('New York history bounds', () => {
  it('uses Eastern midnight, including daylight-saving changes', () => {
    assert.equal(nyMidnightUtc('2026-01-15').toISOString(), '2026-01-15T05:00:00.000Z')
    assert.equal(nyMidnightUtc('2026-07-15').toISOString(), '2026-07-15T04:00:00.000Z')
    assert.equal(nyMidnightUtc('2026-03-08').toISOString(), '2026-03-08T05:00:00.000Z')
    assert.equal(nyMidnightUtc('2026-03-09').toISOString(), '2026-03-09T04:00:00.000Z')
    assert.equal(nyMidnightUtc('2026-11-01').toISOString(), '2026-11-01T04:00:00.000Z')
    assert.equal(nyMidnightUtc('2026-11-02').toISOString(), '2026-11-02T05:00:00.000Z')
    assert.equal(calendarDateInNy(at('2026-07-15T03:59:59.999Z')), '2026-07-14')
    assert.equal(calendarDateInNy(at('2026-07-15T04:00:00.000Z')), '2026-07-15')
    assert.equal(calendarDateInNy(at('2026-11-01T05:30:00.000Z')), '2026-11-01')
    assert.equal(calendarDateInNy(at('2026-11-01T06:30:00.000Z')), '2026-11-01')
    const summer = historyWindow('2026-07-14', '2026-07-14')
    assert.equal(new Date(summer.startMs).toISOString(), '2026-07-14T04:00:00.000Z')
    assert.equal(new Date(summer.endMs).toISOString(), '2026-07-15T04:00:00.000Z')
  })
})

describe('history pages', () => {
  const rows: Row[] = [
    row('a', 'judah', -2, 'candy', '2026-07-15T04:00:00.000Z'),
    row('b', 'judah', -2, 'candy', '2026-07-15T04:00:00.000Z'),
    row('c', 'elon', -3, 'Cash', '2026-07-15T04:00:00.000Z'),
    row('d', 'corwin', -4, 'From Judah', '2026-07-15T05:00:00.000Z'),
    row('e', 'judah', -5, 'To elon', '2026-07-15T06:00:00.000Z'),
    row('f', 'judah', 8, 'gift', '2026-07-15T07:00:00.000Z'),
    row('g', 'judah', -1, 'outside', '2026-07-15T03:59:59.999Z'),
    row('h', 'judah', -1, 'next-day', '2026-07-15T04:00:00.000Z'.replace('15T04', '16T04')),
  ]

  it('returns an inclusive New York day without dropping duplicates or transfer descriptions', async () => {
    const db = memorySource(ownedKids, rows)
    const window = historyWindow('2026-07-15', '2026-07-15')
    const page = await readHistoryPage({
      source: db.source,
      ownerUid: OWNER,
      children: ['elon', 'corwin', 'judah'],
      startMs: window.startMs,
      endMs: window.endMs,
      type: 'all',
      limit: 20,
      cursor: null,
    })
    assert.deepEqual(page.records.map((record) => [record.child, record.id, record.description, exactSignedDecimal(record.amount)]), [
      ['elon', 'c', 'Cash', '-3.00'],
      ['judah', 'a', 'candy', '-2.00'],
      ['judah', 'b', 'candy', '-2.00'],
      ['corwin', 'd', 'From Judah', '-4.00'],
      ['judah', 'e', 'To elon', '-5.00'],
      ['judah', 'f', 'gift', '8.00'],
    ])
    assert.equal(page.complete, true)
    assert.equal(exactSignedDecimal(1.005), '1.005')
    assert.equal(exactSignedDecimal(0.1 + 0.2), '0.30000000000000004')
  })

  it('paginates same timestamps without gaps or duplicates', async () => {
    const db = memorySource(ownedKids, rows)
    const window = historyWindow('2026-07-15', '2026-07-15')
    const seen: string[] = []
    let cursor: HistoryCursor | null = null
    let pages = 0
    do {
      const page = await readHistoryPage({
        source: db.source,
        ownerUid: OWNER,
        children: ['judah'],
        startMs: window.startMs,
        endMs: window.endMs,
        type: 'debit',
        limit: 1,
        cursor,
      })
      seen.push(...page.records.map((record) => record.id))
      cursor = page.cursor
      pages += 1
      if (page.complete) break
    } while (pages < 10)
    assert.deepEqual(seen, ['a', 'b', 'e'])
    assert.equal(new Set(seen).size, seen.length)
    assert.ok(pages >= 3 && pages <= 4)
  })

  it('keeps scanning past non-matching rows and keeps transfer descriptions', async () => {
    const db = memorySource(ownedKids, rows)
    const window = historyWindow('2026-07-15', '2026-07-15')
    const first = await readHistoryPage({
      source: db.source,
      ownerUid: OWNER,
      children: ['judah'],
      startMs: window.startMs,
      endMs: window.endMs,
      type: 'credit',
      limit: 10,
      cursor: null,
      maxScan: 2,
    })
    assert.equal(first.records.length, 0)
    assert.equal(first.complete, false)
    const second = await readHistoryPage({
      source: db.source,
      ownerUid: OWNER,
      children: ['judah'],
      startMs: window.startMs,
      endMs: window.endMs,
      type: 'credit',
      limit: 10,
      cursor: first.cursor,
      maxScan: 2,
    })
    assert.deepEqual(second.records.map((record) => record.id), ['f'])
    const debits = await readHistoryPage({
      source: db.source,
      ownerUid: OWNER,
      children: ['elon', 'corwin', 'judah'],
      startMs: window.startMs,
      endMs: window.endMs,
      type: 'debit',
      limit: 10,
      cursor: null,
    })
    assert.deepEqual(debits.records.map((record) => record.description), [
      'Cash',
      'candy',
      'candy',
      'From Judah',
      'To elon',
    ])
  })

  it('does not read transactions for an unowned or ambiguous child', async () => {
    const foreign = memorySource([{ id: 'other', slug: 'judah', parentId: OTHER }], rows)
    const window = historyWindow('2026-07-15', '2026-07-15')
    await assert.rejects(
      () => readHistoryPage({
        source: foreign.source,
        ownerUid: OWNER,
        children: ['judah'],
        startMs: window.startMs,
        endMs: window.endMs,
        type: 'all',
        limit: 10,
        cursor: null,
      }),
      (error: unknown) => error instanceof AllowanceError && error.code === 'child_not_found',
    )
    assert.equal(foreign.reads, 0)

    const ambiguous = memorySource([
      { id: 'one', slug: 'elon', parentId: OWNER },
      { id: 'two', slug: 'elon', parentId: OWNER },
    ], rows)
    await assert.rejects(
      () => readHistoryPage({
        source: ambiguous.source,
        ownerUid: OWNER,
        children: ['elon'],
        startMs: window.startMs,
        endMs: window.endMs,
        type: 'all',
        limit: 10,
        cursor: null,
      }),
      (error: unknown) => error instanceof AllowanceError && error.code === 'ambiguous_child',
    )
    assert.equal(ambiguous.reads, 0)
  })
})

function row(id: string, child: AllowedChild, amount: number, description: string, iso: string): Row {
  return {
    id,
    child,
    kidId: `kid-${child}`,
    amount,
    description,
    timestamp: at(iso),
  }
}

describe('history HTTP', () => {
  it('authenticates and validates before any ledger read', async () => {
    let reads = 0
    const deps = historyDeps({
      async historySource() {
        reads += 1
        return memorySource(ownedKids, []).source
      },
    })
    const missing = await handleHistory(new Request('https://www.trackallowance.com/api/allowance/history'), deps)
    assert.equal(missing.status, 401)
    assert.equal(reads, 0)

    const closed = historyDeps({ env: {} as NodeJS.ProcessEnv })
    const unconfigured = await handleHistory(authed('/api/allowance/history?child=judah&start=2026-07-01&end=2026-07-31'), closed)
    assert.equal(unconfigured.status, 503)
    assert.equal(reads, 0)

    const unknown = await handleHistory(authed('/api/allowance/history?child=judah&start=2026-07-01&end=2026-07-31&owner=nope'), deps)
    assert.equal((await unknown.json()).field, 'owner')
    const bad = await handleHistory(authed('/api/allowance/history?child=mallory&start=2026-07-01&end=2026-07-31'), deps)
    assert.equal(bad.status, 400)
    assert.equal((await bad.json()).field, 'child')
    const upsideDown = await handleHistory(authed('/api/allowance/history?child=judah&start=2026-08-01&end=2026-07-01'), deps)
    assert.equal(upsideDown.status, 400)
    const long = await handleHistory(authed('/api/allowance/history?child=all&start=2026-01-01&end=2027-01-02'), deps)
    assert.equal(long.status, 400)
    const badType = await handleHistory(authed('/api/allowance/history?child=judah&start=2026-07-01&end=2026-07-02&type=purchase'), deps)
    assert.equal((await badType.json()).field, 'type')
    const badCursor = await handleHistory(authed('/api/allowance/history?child=judah&start=2026-07-01&end=2026-07-02&cursor=not-a-cursor'), deps)
    assert.equal((await badCursor.json()).field, 'cursor')
    assert.equal(reads, 0)
    assert.equal(JSON.stringify(depsLogs(deps)).includes(TOKEN), false)
  })

  it('returns raw debits for all three children and preserves descriptions', async () => {
    const db = memorySource(ownedKids, [
      row('j1', 'judah', -2.5, '  candy  ', '2026-09-15T15:00:00.000Z'),
      row('e1', 'elon', -1, 'Cash', '2026-09-15T15:00:00.000Z'),
      row('c1', 'corwin', 4, 'From Judah', '2026-10-01T16:00:00.000Z'),
    ])
    const deps = historyDeps({ async historySource() { return db.source } })
    const response = await handleHistory(authed(
      '/api/allowance/history?child=all&start=2026-09-08&end=2026-11-08&type=all&limit=50',
    ), deps)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.json()
    assert.equal(body.timezone, 'America/New_York')
    assert.equal(body.typeMeaning, 'every finite amount')
    assert.deepEqual(body.entries.map((entry: { id: string; description: string; amount: string }) =>
      [entry.id, entry.description, entry.amount]), [
      ['e1', 'Cash', '-1.00'],
      ['j1', '  candy  ', '-2.50'],
      ['c1', 'From Judah', '4.00'],
    ])
    assert.equal(body.page.complete, true)
    assert.equal(body.nextCursor, null)
    assert.equal(JSON.stringify(body).includes(OWNER), false)
    assert.equal(JSON.stringify(body).includes(TOKEN), false)
  })

  it('does not leak internal failures and reports a missing index without its message', async () => {
    const deps = historyDeps({
      async historySource() {
        const error = new Error('https://console.example/index?secret=1') as Error & { code: string }
        error.code = 'failed-precondition'
        throw error
      },
    })
    const response = await handleHistory(authed('/api/allowance/history?child=judah&start=2026-09-01&end=2026-09-30'), deps)
    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), { error: 'index_required' })
  })
})

describe('firestore history query', () => {
  it('ranges the stored timestamp and orders ties by document id', async () => {
    const calls: string[] = []
    const db = {
      collection() {
        return {
          where(field: string, op: string, value: unknown) {
            calls.push(`kids ${field} ${op} ${String(value)}`)
            return {
              limit(count: number) {
                calls.push(`limit ${count}`)
                return { async get() { return { docs: [{ id: 'kid-judah', get(name: string) { return name === 'slug' ? 'judah' : OWNER } }] } } }
              },
              doc() {
                return { collection() { return transactionQuery() } }
              },
            }
          },
          doc(id: string) {
            calls.push(`doc ${id}`)
            return { collection() { return transactionQuery() } }
          },
        }
      },
    }
    function transactionQuery() {
      const query = {
        where(field: string, op: string) {
          calls.push(`tx ${field} ${op}`)
          return query
        },
        orderBy(field: unknown) {
          calls.push(`order ${String(field)}`)
          return query
        },
        startAfter() {
          calls.push('startAfter')
          return query
        },
        limit(count: number) {
          calls.push(`txlimit ${count}`)
          return query
        },
        async get() {
          return {
            docs: [{
              id: 'txn1',
              get(field: string) {
                if (field === 'date') return { toDate: () => at('2026-09-15T15:00:00.000Z') }
                if (field === 'amount') return -2
                if (field === 'description') return 'candy'
                return undefined
              },
            }],
          }
        },
      }
      return query
    }
    const source = createFirestoreHistorySource(db as unknown as HistoryDb, {
      documentId: () => 'document-id',
      toTimestamp: (date) => date.toISOString(),
      fromTimestamp: (value) => (value && typeof value === 'object' && 'toDate' in value ? (value as { toDate: () => Date }).toDate() : null),
    })
    const window = historyWindow('2026-09-15', '2026-09-15')
    const page = await readHistoryPage({
      source,
      ownerUid: OWNER,
      children: ['judah'],
      startMs: window.startMs,
      endMs: window.endMs,
      type: 'debit',
      limit: 10,
      cursor: null,
    })
    assert.deepEqual(page.records.map((record) => record.description), ['candy'])
    assert.equal(calls.some((call) => call.startsWith('tx amount')), false)
    assert.equal(calls.includes('order date'), true)
    assert.equal(calls.includes('order document-id'), true)
    assert.equal(calls.includes('tx date >='), true)
    assert.equal(calls.includes('tx date <'), true)
  })
})

function historyDeps(overrides: Partial<HistoryDeps>): HistoryDeps & { logs: LogEvent[] } {
  const logs: LogEvent[] = []
  return {
    logs,
    env: {
      ALLOWANCE_BOT_TOKEN: TOKEN,
      ALLOWANCE_OWNER_UID: OWNER,
      FIREBASE_PROJECT_ID: 'allowance-25489',
      FIREBASE_CLIENT_EMAIL: EMAIL,
      FIREBASE_PRIVATE_KEY: PRIVATE_KEY,
    } as unknown as NodeJS.ProcessEnv,
    now: () => new Date('2026-11-08T15:00:00.000Z'),
    rateLimit: () => true,
    log: (event) => logs.push(event),
    async historySource() {
      return memorySource(ownedKids, []).source
    },
    ...overrides,
  }
}

function depsLogs(deps: HistoryDeps & { logs?: LogEvent[] }): LogEvent[] {
  return deps.logs ?? []
}

function authed(path: string) {
  return new Request(`https://www.trackallowance.com${path}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
}
