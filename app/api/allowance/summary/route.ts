import { getBotFirestore } from '@/app/lib/allowance-api/admin'
import { bearerAuthorized } from '@/app/lib/allowance-api/auth'
import { assessWriteConfig, botTokenFromEnv } from '@/app/lib/allowance-api/config'
import {
  ALLOWED_CHILDREN,
  isAllowedChild,
  KID_LOOKUP_LIMIT,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type AllowedChild,
} from '@/app/lib/allowance-api/constants'
import { formatMoney } from '@/app/lib/allowance-api/money'
import { createRateLimiter } from '@/app/lib/allowance-api/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const rateLimit = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)

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

export async function GET(request: Request): Promise<Response> {
  const token = botTokenFromEnv(process.env)
  if (!token) {
    return json(503, { error: 'not_configured' })
  }
  if (!rateLimit(Date.now())) {
    return json(429, { error: 'rate_limited' })
  }
  if (!bearerAuthorized(request.headers.get('authorization'), token)) {
    return json(401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' })
  }

  const config = assessWriteConfig(process.env)
  if (!config.writeReady || !config.ownerUid) {
    return json(503, { error: 'not_configured', missing: config.missing })
  }

  const url = new URL(request.url)
  const rawChild = url.searchParams.get('child')
  let targetChildren: readonly AllowedChild[] = ALLOWED_CHILDREN
  if (rawChild !== null) {
    const slug = rawChild.trim().toLowerCase()
    if (!isAllowedChild(slug)) {
      return json(400, { error: 'invalid_request', field: 'child' })
    }
    targetChildren = [slug]
  }

  try {
    const db = getBotFirestore()
    const summaries = []

    for (const childSlug of targetChildren) {
      const snap = await db
        .collection('kids')
        .where('slug', '==', childSlug)
        .limit(KID_LOOKUP_LIMIT)
        .get()

      const owned = snap.docs.filter((d) => d.get('parentId') === config.ownerUid)
      if (owned.length !== 1) continue

      const kidDoc = owned[0]
      const total = Number(kidDoc.get('total') || 0)
      const name = String(kidDoc.get('name') || childSlug)
      const weeklyAllowance = Number(kidDoc.get('weeklyAllowance') || 0)
      const allowanceDay = String(kidDoc.get('allowanceDay') || 'Sunday')
      const interestRateMonthly = Number(kidDoc.get('interestRateMonthly') || 0)

      const goalsSnap = await db
        .collection('kids')
        .doc(kidDoc.id)
        .collection('goals')
        .get()

      const subAccounts = goalsSnap.docs
        .map((g) => {
          const data = g.data()
          return {
            id: g.id,
            name: String(data.name || 'Sub-Account'),
            type: data.type === 'bucket' ? 'bucket' : 'goal',
            icon: String(data.icon || '🎯'),
            currentAmount: formatMoney(Number(data.currentAmount ?? data.savedAmount ?? 0)),
            currentAmountNumber: Number(data.currentAmount ?? data.savedAmount ?? 0),
            targetAmount: formatMoney(Number(data.targetAmount || 0)),
            autoSplitPercent: Number(data.autoSplitPercent || 0),
            completed: Boolean(data.completed || data.status === 'completed'),
          }
        })
        .filter((g) => !g.completed)

      const savedNumber = subAccounts.reduce((s, g) => s + g.currentAmountNumber, 0)
      const spendableNumber = total - savedNumber

      summaries.push({
        child: childSlug,
        name,
        total: formatMoney(total),
        spendableBalance: formatMoney(spendableNumber),
        savedInSubAccounts: formatMoney(savedNumber),
        weeklyAllowance: formatMoney(weeklyAllowance),
        allowanceDay,
        interestRateMonthly,
        subAccounts: subAccounts.map(({ currentAmountNumber, ...rest }) => rest),
      })
    }

    return json(200, { children: summaries })
  } catch {
    return json(500, { error: 'internal_error' })
  }
}
