import { HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT, HISTORY_TIME_ZONE, isAllowedChild, type AllowedChild } from './constants'
import { AllowanceError } from './errors'
import { assessWriteConfig } from './config'
import { bearerAuthorized } from './auth'
import { botTokenFromEnv } from './config'
import {
  childrenForScope,
  exactSignedDecimal,
  readHistoryPage,
  type HistoryCursor,
  type HistorySource,
  type HistoryType,
} from './history'
import { calendarDateInNy, historyWindow, parseHistoryDate } from './history-time'
import type { LogEvent } from './http'

const QUERY_KEYS = new Set(['child', 'start', 'end', 'type', 'limit', 'cursor'])

export type HistoryDeps = {
  env: NodeJS.ProcessEnv
  now: () => Date
  rateLimit: (nowMs: number) => boolean
  log: (event: LogEvent) => void
  historySource: () => Promise<HistorySource>
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

function authorize(request: Request, deps: HistoryDeps):
  | { ok: true }
  | { ok: false; response: Response } {
  const token = botTokenFromEnv(deps.env)
  if (!token) {
    deps.log({ route: 'history', status: 503, code: 'not_configured' })
    return { ok: false, response: json(503, { error: 'not_configured' }) }
  }
  if (!deps.rateLimit(deps.now().getTime())) {
    deps.log({ route: 'history', status: 429, code: 'rate_limited' })
    return { ok: false, response: json(429, { error: 'rate_limited' }) }
  }
  if (!bearerAuthorized(request.headers.get('authorization'), token)) {
    deps.log({ route: 'history', status: 401, code: 'unauthorized' })
    return {
      ok: false,
      response: json(401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' }),
    }
  }
  return { ok: true }
}

export function encodeHistoryCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify({
    v: 1,
    t: new Date(cursor.ms).toISOString(),
    c: cursor.child,
    id: cursor.id,
  }), 'utf8').toString('base64url')
}

export function decodeHistoryCursor(
  value: string,
  startMs: number,
  endMs: number,
  allowed: readonly AllowedChild[],
): HistoryCursor {
  if (!/^[A-Za-z0-9_-]{1,500}$/.test(value)) throw new AllowanceError('invalid_request', 400, 'cursor')
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    throw new AllowanceError('invalid_request', 400, 'cursor')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AllowanceError('invalid_request', 400, 'cursor')
  }
  const record = parsed as Record<string, unknown>
  if (record.v !== 1 || typeof record.t !== 'string' || typeof record.c !== 'string' || typeof record.id !== 'string') {
    throw new AllowanceError('invalid_request', 400, 'cursor')
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.t)) {
    throw new AllowanceError('invalid_request', 400, 'cursor')
  }
  const ms = Date.parse(record.t)
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== record.t || ms < startMs || ms >= endMs) {
    throw new AllowanceError('invalid_request', 400, 'cursor')
  }
  if (!isAllowedChild(record.c) || !allowed.includes(record.c)) {
    throw new AllowanceError('invalid_request', 400, 'cursor')
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(record.id)) throw new AllowanceError('invalid_request', 400, 'cursor')
  return { ms, child: record.c, id: record.id }
}

function parseScope(value: string | null): AllowedChild | 'all' {
  if (!value) throw new AllowanceError('invalid_request', 400, 'child')
  const slug = value.trim().toLowerCase()
  if (slug === 'all') return 'all'
  if (!/^[a-z]+$/.test(slug) || !isAllowedChild(slug)) throw new AllowanceError('invalid_request', 400, 'child')
  return slug
}

function parseType(value: string | null): HistoryType {
  const type = value ?? 'all'
  if (type !== 'all' && type !== 'debit' && type !== 'credit') {
    throw new AllowanceError('invalid_request', 400, 'type')
  }
  return type
}

function parseLimit(value: string | null): number {
  const raw = value ?? String(HISTORY_DEFAULT_LIMIT)
  if (!/^[1-9]\d*$/.test(raw)) throw new AllowanceError('invalid_request', 400, 'limit')
  const limit = Number(raw)
  if (limit > HISTORY_MAX_LIMIT) throw new AllowanceError('invalid_request', 400, 'limit')
  return limit
}

export async function handleHistory(request: Request, deps: HistoryDeps): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' })
  const auth = authorize(request, deps)
  if (!auth.ok) return auth.response

  let childForLog: string | null = null
  try {
    const url = new URL(request.url)
    url.searchParams.forEach((_value, key) => {
      if (!QUERY_KEYS.has(key)) throw new AllowanceError('invalid_request', 400, key)
    })
    const scope = parseScope(url.searchParams.get('child'))
    childForLog = scope
    const start = parseHistoryDate(url.searchParams.get('start'), 'start')
    const end = parseHistoryDate(url.searchParams.get('end'), 'end')
    const type = parseType(url.searchParams.get('type'))
    const limit = parseLimit(url.searchParams.get('limit'))
    const window = historyWindow(start, end)
    const children = childrenForScope(scope)
    const cursorValue = url.searchParams.get('cursor')
    const cursor = cursorValue
      ? decodeHistoryCursor(cursorValue, window.startMs, window.endMs, children)
      : null

    const config = assessWriteConfig(deps.env)
    if (!config.writeReady || !config.ownerUid) {
      deps.log({ route: 'history', status: 503, code: 'not_configured', child: scope })
      return json(503, { error: 'not_configured', missing: config.missing })
    }

    const source = await deps.historySource()
    const page = await readHistoryPage({
      source,
      ownerUid: config.ownerUid,
      children,
      startMs: window.startMs,
      endMs: window.endMs,
      type,
      limit,
      cursor,
    })
    deps.log({
      route: 'history',
      status: 200,
      code: page.complete ? 'complete' : 'page',
      child: scope,
    })
    return json(200, {
      timezone: HISTORY_TIME_ZONE,
      start,
      end,
      bounds: {
        startInclusive: new Date(window.startMs).toISOString(),
        endExclusive: new Date(window.endMs).toISOString(),
      },
      child: scope,
      type,
      typeMeaning: type === 'debit'
        ? 'amount < 0'
        : type === 'credit'
          ? 'amount > 0'
          : 'every finite amount',
      order: ['timestamp', 'child', 'id'],
      entries: page.records.map((record) => ({
        id: record.id,
        child: record.child,
        amount: exactSignedDecimal(record.amount),
        description: record.description,
        timestamp: record.timestamp.toISOString(),
        calendarDate: calendarDateInNy(record.timestamp),
      })),
      page: {
        returned: page.records.length,
        limit,
        complete: page.complete,
      },
      nextCursor: page.cursor ? encodeHistoryCursor(page.cursor) : null,
    })
  } catch (error) {
    if (error instanceof AllowanceError) {
      deps.log({ route: 'history', status: error.status, code: error.code, child: childForLog })
      return json(error.status, {
        error: error.code,
        ...(error.field ? { field: error.field } : {}),
      })
    }
    const code = failedPrecondition(error) ? 'index_required' : 'internal_error'
    deps.log({ route: 'history', status: code === 'index_required' ? 500 : 500, code, child: childForLog })
    return json(500, { error: code })
  }
}

function failedPrecondition(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return code === 'failed-precondition' || code === 9
}
