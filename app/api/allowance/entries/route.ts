import { POST as createEntry } from '@/app/lib/allowance-api/production'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function POST(request: Request) {
  return createEntry(request)
}
