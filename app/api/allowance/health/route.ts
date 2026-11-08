import { GET as health } from '@/app/lib/allowance-api/production'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  return health(request)
}
