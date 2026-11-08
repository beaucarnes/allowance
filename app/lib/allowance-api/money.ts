import { MAX_AMOUNT_CENTS, MAX_DESCRIPTION_LENGTH, MIN_CALENDAR_DATE, LEDGER_TIME_ZONE } from './constants'

export function todayInLedgerZone(now: Date, timeZone = LEDGER_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Positive cent amount with at most two decimal places, or null. */
export function parseAmountCents(value: unknown): number | null {
  if (typeof value === 'boolean' || value == null) return null
  let raw: string
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    raw = value.toString()
    if (/[eE]/.test(raw)) return null
  } else if (typeof value === 'string') {
    raw = value.trim()
  } else {
    return null
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null
  const [whole, frac = ''] = raw.split('.')
  if (whole.length > 1 && whole.startsWith('0')) return null
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_AMOUNT_CENTS) return null
  return cents
}

export function centsToAmount(cents: number): number {
  return Number((cents / 100).toFixed(2))
}

export function formatMoney(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2)
}

export function signedCents(type: 'debit' | 'credit', amountCents: number): number {
  return type === 'debit' ? -amountCents : amountCents
}

export function addCents(current: number, deltaCents: number): number {
  const currentCents = Math.round(current * 100)
  return Number(((currentCents + deltaCents) / 100).toFixed(2))
}

export function parseDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const description = value.trim()
  if (description.length < 1 || description.length > MAX_DESCRIPTION_LENGTH) return null
  if (/[\u0000-\u001F\u007F]/.test(description)) return null
  return description
}

export function parseCalendarDate(value: unknown, now: Date): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null
  }
  if (value < MIN_CALENDAR_DATE || value > todayInLedgerZone(now)) return null
  return value
}

/** Noon UTC keeps the calendar date stable across US local displays. */
export function noonUtc(calendarDate: string): Date {
  const year = Number(calendarDate.slice(0, 4))
  const month = Number(calendarDate.slice(5, 7))
  const day = Number(calendarDate.slice(8, 10))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
}
