import { HISTORY_MAX_DATE, HISTORY_MAX_RANGE_DAYS, HISTORY_TIME_ZONE, MIN_CALENDAR_DATE } from './constants'
import { AllowanceError } from './errors'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseHistoryDate(value: string | null, field: string): string {
  if (!value || !DATE_RE.test(value)) throw new AllowanceError('invalid_request', 400, field)
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day ||
    value < MIN_CALENDAR_DATE ||
    value > HISTORY_MAX_DATE
  ) {
    throw new AllowanceError('invalid_request', 400, field)
  }
  return value
}

export function addCalendarDays(isoDate: string, days: number): string {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function inclusiveDayCount(start: string, end: string): number {
  const startUtc = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)))
  const endUtc = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)))
  return Math.round((endUtc - startUtc) / 86_400_000) + 1
}

function zoneParts(instant: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HISTORY_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const map: Record<string, string> = {}
  for (const part of parts) map[part.type] = part.value
  let year = Number(map.year)
  let month = Number(map.month)
  let day = Number(map.day)
  let hour = Number(map.hour)
  if (hour === 24) {
    hour = 0
    const next = new Date(Date.UTC(year, month - 1, day + 1))
    year = next.getUTCFullYear()
    month = next.getUTCMonth() + 1
    day = next.getUTCDate()
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function offsetMs(instant: Date): number {
  const parts = zoneParts(instant)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - instant.getTime()
}

/** Midnight at the start of the New York calendar date, as a UTC instant. */
export function nyMidnightUtc(isoDate: string): Date {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0)
  let instant = new Date(utcMidnight - offsetMs(new Date(utcMidnight)))
  instant = new Date(utcMidnight - offsetMs(instant))
  return instant
}

export function calendarDateInNy(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HISTORY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const map: Record<string, string> = {}
  for (const part of parts) map[part.type] = part.value
  return `${map.year}-${map.month}-${map.day}`
}

export function historyWindow(start: string, end: string): { startMs: number; endMs: number } {
  if (end < start) throw new AllowanceError('invalid_request', 400, 'end')
  if (inclusiveDayCount(start, end) > HISTORY_MAX_RANGE_DAYS) {
    throw new AllowanceError('invalid_request', 400, 'end')
  }
  return {
    startMs: nyMidnightUtc(start).getTime(),
    endMs: nyMidnightUtc(addCalendarDays(end, 1)).getTime(),
  }
}
