import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { recordAllowanceEntry, type EntryRequest, type LedgerStore, type LedgerTx } from '../../app/lib/allowance-api/ledger'
import { AllowanceError } from '../../app/lib/allowance-api/errors'
import { memoryLedger } from './memory-store'

const OWNER = 'BeauOwnerUid123456'
const OTHER = 'SomeoneElseUid1234'

function request(overrides: Partial<EntryRequest> = {}): EntryRequest {
  return {
    child: 'judah',
    type: 'debit',
    amountCents: 200,
    description: 'candy',
    calendarDate: '2026-11-07',
    date: new Date('2026-11-07T12:00:00.000Z'),
    idempotencyKey: 'candy-2026-11-07-01',
    ownerUid: OWNER,
    ...overrides,
  }
}

function beauKids() {
  return memoryLedger([
    { id: 'kid-judah', slug: 'judah', parentId: OWNER, total: 84.14 },
    { id: 'kid-elon', slug: 'elon', parentId: OWNER, total: 10 },
    { id: 'kid-corwin', slug: 'corwin', parentId: OWNER, total: 3.5 },
    { id: 'other-judah', slug: 'judah', parentId: OTHER, total: 50 },
  ])
}

describe('ledger ownership and amounts', () => {
  it('debits only the owned child and stores a negative amount atomically', async () => {
    const db = beauKids()
    const result = await recordAllowanceEntry(db.store, request())
    assert.equal(result.idempotentReplay, false)
    assert.equal(result.total, '82.14')
    assert.equal(result.signedAmount, -2)
    assert.equal(result.amount, '2.00')
    assert.equal(result.date, '2026-11-07')
    assert.equal(db.kids.find((kid) => kid.id === 'kid-judah')?.total, 82.14)
    assert.equal(db.kids.find((kid) => kid.id === 'other-judah')?.total, 50)
    assert.equal(db.entries.size, 1)
    const entry = Array.from(db.entries.values())[0]
    assert.equal(entry.amount, -2)
    assert.equal(entry.description, 'candy')
    assert.equal(entry.calendarDate, '2026-11-07')
  })

  it('credits the owned child', async () => {
    const db = beauKids()
    const result = await recordAllowanceEntry(db.store, request({
      child: 'elon',
      type: 'credit',
      amountCents: 125,
      description: 'chore',
      idempotencyKey: 'elon-chore-0001',
    }))
    assert.equal(result.signedAmount, 1.25)
    assert.equal(result.total, '11.25')
    assert.equal(db.kids.find((kid) => kid.id === 'kid-elon')?.total, 11.25)
  })

  it('does not write when the slug belongs to someone else', async () => {
    const db = memoryLedger([{ id: 'other-judah', slug: 'judah', parentId: OTHER, total: 50 }])
    await assert.rejects(
      () => recordAllowanceEntry(db.store, request()),
      (error: unknown) => error instanceof AllowanceError && error.code === 'child_not_found',
    )
    assert.equal(db.entries.size, 0)
    assert.equal(db.kids[0].total, 50)
  })

  it('does not write when ownership is ambiguous or the slug page is full', async () => {
    const ambiguous = memoryLedger([
      { id: 'a', slug: 'corwin', parentId: OWNER, total: 1 },
      { id: 'b', slug: 'corwin', parentId: OWNER, total: 2 },
    ])
    await assert.rejects(
      () => recordAllowanceEntry(ambiguous.store, request({ child: 'corwin', idempotencyKey: 'corwin-key-000001' })),
      (error: unknown) => error instanceof AllowanceError && error.code === 'ambiguous_child',
    )
    assert.equal(ambiguous.entries.size, 0)
    assert.equal(ambiguous.kids[0].total, 1)

    const crowded = memoryLedger(
      Array.from({ length: 10 }, (_, index) => ({
        id: `stranger-${index}`,
        slug: 'judah',
        parentId: OTHER,
        total: 1,
      })),
      { limit: 10 },
    )
    await assert.rejects(
      () => recordAllowanceEntry(crowded.store, request()),
      (error: unknown) => error instanceof AllowanceError && error.code === 'ambiguous_child',
    )
    assert.equal(crowded.entries.size, 0)
  })

  it('rolls back the entry when the balance update fails', async () => {
    const db = memoryLedger(
      [{ id: 'kid-judah', slug: 'judah', parentId: OWNER, total: 84.14 }],
      { failIncrement: true },
    )
    await assert.rejects(() => recordAllowanceEntry(db.store, request()))
    assert.equal(db.entries.size, 0)
    assert.equal(db.kids[0].total, 84.14)
  })

  it('refuses an invalid stored total without writing', async () => {
    const db = memoryLedger([
      { id: 'kid-judah', slug: 'judah', parentId: OWNER, total: 0, totalValid: false },
    ])
    await assert.rejects(
      () => recordAllowanceEntry(db.store, request()),
      (error: unknown) => error instanceof AllowanceError && error.code === 'invalid_kid_total',
    )
    assert.equal(db.entries.size, 0)
  })
})

describe('idempotency', () => {
  it('replays the same key without a second balance change', async () => {
    const db = beauKids()
    const first = await recordAllowanceEntry(db.store, request())
    const second = await recordAllowanceEntry(db.store, request())
    assert.equal(first.idempotentReplay, false)
    assert.equal(second.idempotentReplay, true)
    assert.equal(second.id, first.id)
    assert.equal(second.total, '82.14')
    assert.equal(db.kids.find((kid) => kid.id === 'kid-judah')?.total, 82.14)
    assert.equal(db.entries.size, 1)
  })

  it('conflicts when the same key is reused for a different entry', async () => {
    const db = beauKids()
    await recordAllowanceEntry(db.store, request())
    await assert.rejects(
      () => recordAllowanceEntry(db.store, request({ amountCents: 300, description: 'more candy' })),
      (error: unknown) => error instanceof AllowanceError && error.code === 'idempotency_conflict',
    )
    assert.equal(db.kids.find((kid) => kid.id === 'kid-judah')?.total, 82.14)
    assert.equal(db.entries.size, 1)
  })

  it('does not apply a retried transaction after the entry already exists', async () => {
    const kids = [{ id: 'kid-judah', slug: 'judah', parentId: OWNER, total: 84.14 }]
    let attempts = 0
    const store: LedgerStore = {
      async runTransaction(fn) {
        attempts += 1
        const tx: LedgerTx = {
          async findKidsBySlug() {
            return {
              kids: kids.map((kid) => ({ ...kid, totalValid: true })),
              scanned: 1,
              limit: 10,
            }
          },
          async readEntry() {
            return attempts === 1
              ? { exists: false }
              : {
                  exists: true,
                  amount: -2,
                  description: 'candy',
                  calendarDate: '2026-11-07',
                  requestHash: (await import('../../app/lib/allowance-api/ledger')).entryRequestHash(request()),
                }
          },
          createEntry() {
            if (attempts === 2) throw new Error('retry must not create')
          },
          incrementTotal() {
            if (attempts === 1) kids[0].total = 80.14
            if (attempts === 2) throw new Error('retry must not increment')
          },
        }
        if (attempts === 1) {
          await fn(tx)
          kids[0].total = 82.14
          return store.runTransaction(fn)
        }
        return fn(tx)
      },
    }
    const result = await recordAllowanceEntry(store, request())
    assert.equal(result.idempotentReplay, true)
    assert.equal(result.total, '82.14')
    assert.equal(kids[0].total, 82.14)
  })
})
