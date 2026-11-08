import { createHash, randomBytes } from 'node:crypto'
import { getAdminFirestore } from '@/app/lib/firebase-admin-app'

export const PARENT_TOKEN_PREFIX = 'ta_live_'

export function generateParentBotToken(): {
  plaintext: string
  tokenHash: string
  tokenPrefix: string
} {
  const secretHex = randomBytes(24).toString('hex')
  const plaintext = `${PARENT_TOKEN_PREFIX}${secretHex}`
  const tokenHash = hashBotToken(plaintext)
  const tokenPrefix = `${plaintext.slice(0, 14)}...${plaintext.slice(-4)}`
  return { plaintext, tokenHash, tokenPrefix }
}

export function hashBotToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function extractParentBearer(authorization: string | null): string | null {
  if (!authorization) return null
  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null
  const token = parts[1]
  if (!token.startsWith(PARENT_TOKEN_PREFIX) || token.length < 32 || /\s/.test(token)) {
    return null
  }
  return token
}

export interface ResolvedParentScope {
  ownerUid: string
  allowedChildren: string[]
}

export async function resolveParentTokenScope(
  authorization: string | null
): Promise<ResolvedParentScope | null> {
  const token = extractParentBearer(authorization)
  if (!token) return null

  const tokenHash = hashBotToken(token)
  const db = getAdminFirestore()

  const tokenSnap = await db
    .collection('botTokens')
    .where('tokenHash', '==', tokenHash)
    .limit(2)
    .get()

  if (tokenSnap.empty || tokenSnap.docs.length !== 1) {
    return null
  }

  const tokenDoc = tokenSnap.docs[0]
  const ownerUid = tokenDoc.get('uid')
  if (typeof ownerUid !== 'string' || !ownerUid) {
    return null
  }

  const kidsSnap = await db
    .collection('kids')
    .where('parentId', '==', ownerUid)
    .get()

  const allowedChildren = kidsSnap.docs
    .map((d) => String(d.get('slug') || '').trim().toLowerCase())
    .filter((slug) => /^[a-z0-9]+$/.test(slug))

  return {
    ownerUid,
    allowedChildren,
  }
}
