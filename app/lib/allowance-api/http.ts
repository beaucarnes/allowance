import { ALLOWED_CHILDREN, isAllowedChild, type AllowedChild } from './constants'
import { AllowanceError } from './errors'
import { assessWriteConfig, botTokenFromEnv } from './config'
import { bearerAuthorized, secretsEqual } from './auth'
import { recordAllowanceEntry, type EntryResult, type LedgerStore } from './ledger'
import {
  noonUtc,
  parseAmountCents,
  parseCalendarDate,
  parseDescription,
} from './money'

const BODY_KEYS = new Set(['child', 'type', 'amount', 'description', 'date'])
const MAX_BODY_CHARS = 4096

export type LogEvent = {
  route: 'health' | 'entries' | 'history'
  status: number
  code?: string
  child?: string | null
  replay?: boolean | null
}

export type HandlerDeps = {
  env: NodeJS.ProcessEnv
  now: () => Date
  rateLimit: (nowMs: number) => boolean
  ledgerStore: () => Promise<LedgerStore>
  log: (event: LogEvent) => void
}

export function logAllowanceEvent(event: LogEvent): void {
  const child = event.child === 'all' || (event.child && isAllowedChild(event.child))
    ? event.child
    : null
  console.info(JSON.stringify({
    source: 'allowance-bot-api',
    route: event.route,
    status: event.status,
    code: event.code ?? null,
    child,
    replay: event.replay ?? null,
  }))
}

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

function parseChild(value: unknown): AllowedChild | null {
  if (typeof value !== 'string') return null
  const slug = value.trim().toLowerCase()
  if (!/^[a-z]+$/.test(slug) || !isAllowedChild(slug)) return null
  return slug
}

function authorize(request: Request, deps: HandlerDeps, route: LogEvent['route']):
  | { ok: true; token: string }
  | { ok: false; response: Response } {
  const token = botTokenFromEnv(deps.env)
  if (!token) {
    deps.log({ route, status: 503, code: 'not_configured' })
    return { ok: false, response: json(503, { error: 'not_configured' }) }
  }
  if (!deps.rateLimit(deps.now().getTime())) {
    deps.log({ route, status: 429, code: 'rate_limited' })
    return { ok: false, response: json(429, { error: 'rate_limited' }) }
  }
  if (!bearerAuthorized(request.headers.get('authorization'), token)) {
    deps.log({ route, status: 401, code: 'unauthorized' })
    return {
      ok: false,
      response: json(401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' }),
    }
  }
  return { ok: true, token }
}

export async function handleHealth(request: Request, deps: HandlerDeps): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'method_not_allowed' })
  }
  const auth = authorize(request, deps, 'health')
  if (!auth.ok) return auth.response
  const config = assessWriteConfig(deps.env)
  deps.log({ route: 'health', status: 200, code: config.writeReady ? 'ready' : 'not_ready' })
  return json(200, {
    authenticated: true,
    writeReady: config.writeReady,
    firebaseProject: config.firebase,
    missing: config.missing,
    scope: {
      children: ALLOWED_CHILDREN,
      ownership: 'parentId',
      readsLedger: false,
    },
  })
}

export async function handleEntry(request: Request, deps: HandlerDeps): Promise<Response> {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }
  const auth = authorize(request, deps, 'entries')
  if (!auth.ok) return auth.response

  let childForLog: string | null = null
  try {
    const parsed = await parseEntryRequest(request, deps.now(), auth.token)
    childForLog = parsed.child
    const config = assessWriteConfig(deps.env)
    if (!config.writeReady || !config.ownerUid) {
      deps.log({ route: 'entries', status: 503, code: 'not_configured', child: parsed.child })
      return json(503, { error: 'not_configured', missing: config.missing })
    }
    const store = await deps.ledgerStore()
    const result = await recordAllowanceEntry(store, {
      ...parsed,
      ownerUid: config.ownerUid,
    })
    const status = result.idempotentReplay ? 200 : 201
    deps.log({
      route: 'entries',
      status,
      code: result.idempotentReplay ? 'replay' : 'created',
      child: result.child,
      replay: result.idempotentReplay,
    })
    return json(status, publicEntry(result))
  } catch (error) {
    if (error instanceof AllowanceError) {
      deps.log({ route: 'entries', status: error.status, code: error.code, child: childForLog })
      return json(error.status, {
        error: error.code,
        ...(error.field ? { field: error.field } : {}),
      })
    }
    deps.log({ route: 'entries', status: 500, code: 'internal_error', child: childForLog })
    return json(500, { error: 'internal_error' })
  }
}

function publicEntry(result: EntryResult) {
  return {
    id: result.id,
    child: result.child,
    type: result.type,
    amount: result.amount,
    signedAmount: result.signedAmount,
    description: result.description,
    date: result.date,
    total: result.total,
    idempotentReplay: result.idempotentReplay,
  }
}

async function parseEntryRequest(request: Request, now: Date, token: string): Promise<{
  child: AllowedChild
  type: 'debit' | 'credit'
  amountCents: number
  description: string
  calendarDate: string
  date: Date
  idempotencyKey: string
}> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new AllowanceError('invalid_request', 415, 'content-type')
  }
  const idempotencyKey = request.headers.get('idempotency-key')
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    throw new AllowanceError('invalid_request', 400, 'Idempotency-Key')
  }
  if (secretsEqual(idempotencyKey, token)) {
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

  const child = parseChild(record.child)
  if (!child) throw new AllowanceError('invalid_request', 400, 'child')
  if (record.type !== 'debit' && record.type !== 'credit') {
    throw new AllowanceError('invalid_request', 400, 'type')
  }
  const type = record.type
  const amountCents = parseAmountCents(record.amount)
  if (amountCents == null) throw new AllowanceError('invalid_request', 400, 'amount')
  const description = parseDescription(record.description)
  if (!description) throw new AllowanceError('invalid_request', 400, 'description')
  if (description.includes(token)) throw new AllowanceError('invalid_request', 400, 'description')
  const calendarDate = parseCalendarDate(record.date, now)
  if (!calendarDate) throw new AllowanceError('invalid_request', 400, 'date')

  return {
    child,
    type,
    amountCents,
    description,
    calendarDate,
    date: noonUtc(calendarDate),
    idempotencyKey,
  }
}
