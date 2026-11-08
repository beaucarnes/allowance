import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bearerAuthorized, configuredBotToken, secretsEqual } from '../../app/lib/allowance-api/auth'
import { assessWriteConfig, configuredOwnerUid, firebaseConfigStatus } from '../../app/lib/allowance-api/config'
import {
  addCents,
  centsToAmount,
  parseAmountCents,
  parseCalendarDate,
  parseDescription,
} from '../../app/lib/allowance-api/money'
import { createRateLimiter } from '../../app/lib/allowance-api/rate-limit'

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789'
const OWNER = 'BeauOwnerUid123456'
const EMAIL = 'ledger-admin@example.com'
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${'A'.repeat(120)}\n-----END PRIVATE KEY-----`

function readyEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ALLOWANCE_BOT_TOKEN: TOKEN,
    ALLOWANCE_OWNER_UID: OWNER,
    FIREBASE_PROJECT_ID: 'allowance-25489',
    FIREBASE_CLIENT_EMAIL: EMAIL,
    FIREBASE_PRIVATE_KEY: PRIVATE_KEY,
    ...overrides,
  }
}

describe('bot credential', () => {
  it('fails closed when the token is absent or short', () => {
    assert.equal(configuredBotToken(undefined), null)
    assert.equal(configuredBotToken(''), null)
    assert.equal(configuredBotToken('short-token'), null)
    assert.equal(configuredBotToken(`${TOKEN} extra`), null)
  })

  it('compares bearers without accepting a missing header', () => {
    assert.equal(bearerAuthorized(null, TOKEN), false)
    assert.equal(bearerAuthorized('Basic ' + TOKEN, TOKEN), false)
    assert.equal(bearerAuthorized(`Bearer ${TOKEN} trailing`, TOKEN), false)
    assert.equal(bearerAuthorized(`Bearer ${TOKEN}`, TOKEN), true)
    assert.equal(secretsEqual(TOKEN, TOKEN), true)
    assert.equal(secretsEqual(TOKEN, `${TOKEN}x`), false)
  })
})

describe('owner and firebase config', () => {
  it('accepts only a uid-shaped owner identifier', () => {
    assert.equal(configuredOwnerUid(OWNER), OWNER)
    assert.equal(configuredOwnerUid('short'), null)
    assert.equal(configuredOwnerUid('has space'), null)
    assert.equal(configuredOwnerUid(undefined), null)
  })

  it('reports ready config without echoing secrets', () => {
    const config = assessWriteConfig(readyEnv())
    assert.equal(config.writeReady, true)
    assert.equal(config.firebase, 'ok')
    assert.equal(config.ownerUid, OWNER)
    assert.deepEqual(config.missing, [])
    const publicView = {
      writeReady: config.writeReady,
      firebase: config.firebase,
      missing: config.missing,
    }
    const encoded = JSON.stringify(publicView)
    assert.equal(encoded.includes(TOKEN), false)
    assert.equal(encoded.includes(PRIVATE_KEY), false)
    assert.equal(encoded.includes(EMAIL), false)
    assert.equal(encoded.includes(OWNER), false)
  })

  it('names missing configuration and refuses a different Firebase project', () => {
    const missing = assessWriteConfig({})
    assert.equal(missing.writeReady, false)
    assert.deepEqual(missing.missing, [
      'ALLOWANCE_OWNER_UID',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
    ])
    const mismatch = assessWriteConfig(readyEnv({ FIREBASE_PROJECT_ID: 'other-project' }))
    assert.equal(mismatch.firebase, 'mismatch')
    assert.equal(mismatch.writeReady, false)
    assert.equal(mismatch.missing.includes('FIREBASE_PROJECT_ID'), true)
    assert.equal(JSON.stringify(mismatch).includes('other-project'), false)
    assert.equal(firebaseConfigStatus(readyEnv({ FIREBASE_PRIVATE_KEY: 'not-a-key' })), 'missing')
  })
})

describe('money and dates', () => {
  const afternoon = new Date('2026-11-08T20:00:00.000Z')
  const lateEveningPacific = new Date('2026-11-08T07:30:00.000Z')

  it('accepts positive cent-precision amounts and rejects everything else', () => {
    assert.equal(parseAmountCents('2.00'), 200)
    assert.equal(parseAmountCents(2), 200)
    assert.equal(parseAmountCents('0.5'), 50)
    assert.equal(parseAmountCents('10000'), 1_000_000)
    assert.equal(parseAmountCents('10000.01'), null)
    assert.equal(parseAmountCents(0), null)
    assert.equal(parseAmountCents(-2), null)
    assert.equal(parseAmountCents('2.001'), null)
    assert.equal(parseAmountCents('02.00'), null)
    assert.equal(parseAmountCents('1e2'), null)
    assert.equal(centsToAmount(200), 2)
    assert.equal(addCents(84.14, -200), 82.14)
  })

  it('bounds descriptions and calendar dates in the ledger timezone', () => {
    assert.equal(parseDescription('  candy  '), 'candy')
    assert.equal(parseDescription(''), null)
    assert.equal(parseDescription('a'.repeat(201)), null)
    assert.equal(parseDescription('line\nbreak'), null)
    assert.equal(parseCalendarDate('2026-11-07', afternoon), '2026-11-07')
    assert.equal(parseCalendarDate('2026-11-09', afternoon), null)
    assert.equal(parseCalendarDate('2026-02-31', afternoon), null)
    assert.equal(parseCalendarDate('2026-11-7', afternoon), null)
    assert.equal(parseCalendarDate('2014-12-31', afternoon), null)
    assert.equal(parseCalendarDate('2026-11-08', lateEveningPacific), null)
    assert.equal(parseCalendarDate('2026-11-07', lateEveningPacific), '2026-11-07')
  })
})

describe('rate limit', () => {
  it('stops accepting once the window is full and allows later calls', () => {
    const limit = createRateLimiter(2, 1_000)
    assert.equal(limit(1_000), true)
    assert.equal(limit(1_100), true)
    assert.equal(limit(1_200), false)
    assert.equal(limit(2_001), true)
  })
})
