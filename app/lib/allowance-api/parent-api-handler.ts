import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getBotFirestore } from './admin'
import { secretsEqual } from './auth'
import {
  BOT_PARENT_EMAIL,
  BOT_PARENT_NAME,
  BOT_SOURCE,
  EXPECTED_FIREBASE_PROJECT_ID,
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
  HISTORY_TIME_ZONE,
  KID_LOOKUP_LIMIT,
} from './constants'
import { AllowanceError } from './errors'
import { calendarDateInNy, historyWindow, parseHistoryDate, timestampToDate } from './history-time'
import { entryDocumentId, entryRequestHash } from './ledger'
import {
  addCents,
  centsToAmount,
  formatMoney,
  noonUtc,
  parseAmountCents,
  parseCalendarDate,
  parseDescription,
  signedCents,
} from './money'
import { extractParentBearer, resolveParentTokenScope } from './parent-token'

const BODY_KEYS = new Set(['child', 'type', 'amount', 'description', 'date'])
const MAX_BODY_CHARS = 4096

function json(status: number, body: unknown, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...extra,
    },
  })
}

export async function handleParentTokenHealth(
  request: Request,
  rateLimit: (nowMs: number) => boolean
): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'method_not_allowed' })
  }
  if (!rateLimit(Date.now())) {
    return json(429, { error: 'rate_limited' })
  }
  const scope = await resolveParentTokenScope(request.headers.get('authorization'))
  if (!scope) {
    return json(401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' })
  }

  return json(200, {
    authenticated: true,
    writeReady: true,
    firebaseProject: EXPECTED_FIREBASE_PROJECT_ID,
    missing: [],
    scope: {
      children: scope.allowedChildren,
      ownership: 'parentId',
      readsLedger: true,
    },
  })
}

export async function handleParentTokenEntry(
  request: Request,
  rateLimit: (nowMs: number) => boolean
): Promise<Response> {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }
  if (!rateLimit(Date.now())) {
    return json(429, { error: 'rate_limited' })
  }
  const rawToken = extractParentBearer(request.headers.get('authorization'))
  const scope = await resolveParentTokenScope(request.headers.get('authorization'))
  if (!rawToken || !scope) {
    return json(401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' })
  }

  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
      throw new AllowanceError('invalid_request', 415, 'content-type')
    }
    const idempotencyKey = request.headers.get('idempotency-key')
    if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
      throw new AllowanceError('invalid_request', 400, 'Idempotency-Key')
    }
    if (secretsEqual(idempotencyKey, rawToken)) {
      throw new AllowanceError('invalid_request', 400, 'Idempotency-Key')
    }

    const text = await request.text()
    if (text.length > MAX_BODY_CHARS) throw new AllowanceError('invalid_request', 400, 'body')
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new AllowanceError('invalid_request', 400, 'body')
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new AllowanceError('invalid_request', 400, 'body')
    }
    const record = body as Record<string, unknown>
    for (const key of Object.keys(record)) {
      if (!BODY_KEYS.has(key)) throw new AllowanceError('invalid_request', 400, key)
    }

    const childRaw = typeof record.child === 'string' ? record.child.trim().toLowerCase() : ''
    if (!childRaw || !/^[a-z0-9]+$/.test(childRaw) || !scope.allowedChildren.includes(childRaw)) {
      throw new AllowanceError('invalid_request', 400, 'child')
    }
    if (record.type !== 'debit' && record.type !== 'credit') {
      throw new AllowanceError('invalid_request', 400, 'type')
    }
    const type = record.type
    const amountCents = parseAmountCents(record.amount)
    if (amountCents == null) throw new AllowanceError('invalid_request', 400, 'amount')
    const description = parseDescription(record.description)
    if (!description || description.includes(rawToken)) {
      throw new AllowanceError('invalid_request', 400, 'description')
    }
    const calendarDate = parseCalendarDate(record.date, new Date())
    if (!calendarDate) throw new AllowanceError('invalid_request', 400, 'date')

    const entryId = entryDocumentId(scope.ownerUid, childRaw, idempotencyKey)
    const requestHash = entryRequestHash({
      ownerUid: scope.ownerUid,
      child: childRaw,
      type,
      amountCents,
      description,
      calendarDate,
    })
    const deltaCents = signedCents(type, amountCents)
    const delta = centsToAmount(deltaCents)
    const date = noonUtc(calendarDate)

    const db = getBotFirestore()
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(
        db.collection('kids').where('slug', '==', childRaw).limit(KID_LOOKUP_LIMIT)
      )
      const owned = snap.docs.filter(
        (d) => d.get('slug') === childRaw && d.get('parentId') === scope.ownerUid
      )
      if (snap.docs.length >= KID_LOOKUP_LIMIT || owned.length > 1) {
        throw new AllowanceError('ambiguous_child', 409)
      }
      if (owned.length === 0) {
        throw new AllowanceError('child_not_found', 404)
      }
      const kidDoc = owned[0]
      const currentTotal = Number(kidDoc.get('total') || 0)

      const entryRef = db.collection('kids').doc(kidDoc.id).collection('transactions').doc(entryId)
      const existing = await tx.get(entryRef)
      if (existing.exists) {
        const storedHash = existing.get('requestHash')
        if (storedHash !== requestHash) {
          throw new AllowanceError('idempotency_conflict', 409)
        }
        const storedAmount = Number(existing.get('amount') || delta)
        return {
          id: entryId,
          child: childRaw,
          type: storedAmount < 0 ? 'debit' : 'credit',
          amount: formatMoney(Math.abs(storedAmount)),
          signedAmount: Number(storedAmount.toFixed(2)),
          description: String(existing.get('description') || description),
          date: String(existing.get('calendarDate') || calendarDate),
          total: formatMoney(currentTotal),
          idempotentReplay: true,
        }
      }

      const nextTotal = addCents(currentTotal, deltaCents)
      tx.create(entryRef, {
        amount: delta,
        description,
        calendarDate,
        date: Timestamp.fromDate(date),
        parentName: BOT_PARENT_NAME,
        parentEmail: BOT_PARENT_EMAIL,
        source: BOT_SOURCE,
        requestHash,
      })
      tx.update(db.collection('kids').doc(kidDoc.id), {
        total: FieldValue.increment(delta),
      })

      return {
        id: entryId,
        child: childRaw,
        type,
        amount: formatMoney(centsToAmount(amountCents)),
        signedAmount: delta,
        description,
        date: calendarDate,
        total: formatMoney(nextTotal),
        idempotentReplay: false,
      }
    })

    return json(result.idempotentReplay ? 200 : 201, result)
  } catch (error) {
    if (error instanceof AllowanceError) {
      return json(error.status, {
        error: error.code,
        ...(error.field ? { field: error.field } : {}),
      })
    }
    return json(500, { error: 'internal_error' })
  }
}

export async function handleParentTokenHistory(
  request: Request,
  rateLimit: (nowMs: number) => boolean
): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'method_not_allowed' })
  }
  if (!rateLimit(Date.now())) {
    return json(429, { error: 'rate_limited' })
  }
  const scope = await resolveParentTokenScope(request.headers.get('authorization'))
  if (!scope) {
    return json(401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' })
  }

  try {
    const url = new URL(request.url)
    const start = parseHistoryDate(url.searchParams.get('start'), 'start')
    const end = parseHistoryDate(url.searchParams.get('end'), 'end')
    const window = historyWindow(start, end)

    const childParam = url.searchParams.get('child') ?? 'all'
    let targetChildren = scope.allowedChildren
    if (childParam !== 'all') {
      const slug = childParam.trim().toLowerCase()
      if (!scope.allowedChildren.includes(slug)) {
        throw new AllowanceError('invalid_request', 400, 'child')
      }
      targetChildren = [slug]
    }

    const typeParam = url.searchParams.get('type') ?? 'all'
    if (typeParam !== 'all' && typeParam !== 'debit' && typeParam !== 'credit') {
      throw new AllowanceError('invalid_request', 400, 'type')
    }

    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : HISTORY_DEFAULT_LIMIT
    if (!Number.isInteger(limit) || limit < 1 || limit > HISTORY_MAX_LIMIT) {
      throw new AllowanceError('invalid_request', 400, 'limit')
    }

    const db = getBotFirestore()
    const entries: any[] = []

    for (const slug of targetChildren) {
      const kidSnap = await db
        .collection('kids')
        .where('slug', '==', slug)
        .limit(KID_LOOKUP_LIMIT)
        .get()
      const owned = kidSnap.docs.filter((d) => d.get('parentId') === scope.ownerUid)
      if (owned.length !== 1) continue

      const kidDoc = owned[0]
      const txSnap = await db
        .collection('kids')
        .doc(kidDoc.id)
        .collection('transactions')
        .where('date', '>=', Timestamp.fromDate(new Date(window.startMs)))
        .where('date', '<', Timestamp.fromDate(new Date(window.endMs)))
        .orderBy('date', 'asc')
        .limit(limit)
        .get()

      for (const doc of txSnap.docs) {
        const amount = Number(doc.get('amount') || 0)
        if (!Number.isFinite(amount) || amount === 0) continue
        const txType = amount < 0 ? 'debit' : 'credit'
        if (typeParam !== 'all' && txType !== typeParam) continue
        const dateObj = timestampToDate(doc.get('date'))
        if (!dateObj) continue

        entries.push({
          id: doc.id,
          child: slug,
          date: calendarDateInNy(dateObj),
          timestamp: dateObj.toISOString(),
          type: txType,
          amount: formatMoney(amount),
          signedAmount: Number(amount.toFixed(2)),
          description: String(doc.get('description') || ''),
          _ms: dateObj.getTime(),
        })
      }
    }

    entries.sort((a, b) => a._ms - b._ms || a.child.localeCompare(b.child) || a.id.localeCompare(b.id))
    const pageEntries = entries.slice(0, limit).map(({ _ms, ...rest }) => rest)

    return json(200, {
      window: {
        start,
        end,
        timezone: HISTORY_TIME_ZONE,
        child: childParam,
        type: typeParam,
      },
      page: {
        limit,
        returned: pageEntries.length,
        complete: entries.length <= limit,
      },
      nextCursor: null,
      entries: pageEntries,
    })
  } catch (error) {
    if (error instanceof AllowanceError) {
      return json(error.status, {
        error: error.code,
        ...(error.field ? { field: error.field } : {}),
      })
    }
    return json(500, { error: 'internal_error' })
  }
}
