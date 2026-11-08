import { getHistory } from '@/app/lib/allowance-api/production'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  return getHistory(request)
}
