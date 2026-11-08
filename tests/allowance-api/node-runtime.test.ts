import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)

describe('Vercel Node compatibility', () => {
  it('keeps the build on Node 22, which is the project runtime', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    assert.equal(pkg.engines.node, '22.x')
    assert.equal(pkg.overrides.jwa, '2.0.1')
  })

  it('loads jwa 2.0.1 without the removed SlowBuffer API', () => {
    const jwaPath = require.resolve('jwa')
    const source = readFileSync(jwaPath, 'utf8')
    const header = source.split('\n').slice(0, 12).join('\n')
    assert.equal(header.includes('buffer-equal-constant-time'), false)
    assert.equal(header.includes('SlowBuffer'), false)
    assert.equal(JSON.parse(readFileSync(path.join(path.dirname(jwaPath), 'package.json'), 'utf8')).version, '2.0.1')

    let loadedBrokenModule = false
    const realRequire = createRequire(jwaPath)
    const hookedRequire = (id: string) => {
      if (id === 'buffer-equal-constant-time') {
        loadedBrokenModule = true
        throw new Error('loaded buffer-equal-constant-time')
      }
      return realRequire(id)
    }
    const loaded = loadCommonJs(jwaPath, source, hookedRequire)
    assert.equal(loadedBrokenModule, false)
    const hmac = loaded('HS256')
    const signature = hmac.sign('a.b', 'secret')
    assert.equal(hmac.verify('a.b', signature, 'secret'), true)
    assert.equal(hmac.verify('a.b', signature, 'other-secret'), false)
  })

  it('still rejects the old comparison module when SlowBuffer is missing', () => {
    const file = require.resolve('buffer-equal-constant-time')
    const source = readFileSync(file, 'utf8')
    const realBuffer = require('buffer')
    assert.throws(
      () => loadCommonJs(file, source, (id: string) => {
        if (id !== 'buffer') throw new Error(`unexpected require ${id}`)
        return { ...realBuffer, SlowBuffer: undefined, Buffer: realBuffer.Buffer }
      }),
      (error: unknown) => error instanceof TypeError && /prototype/.test(error.message),
    )
  })

  it('keeps jsonwebtoken verification working through the overridden jwa', () => {
    const jwt = require('jsonwebtoken')
    const secret = 'test-secret-at-least-32-chars-long'
    const token = jwt.sign({ amount: 2 }, secret, { algorithm: 'HS256' })
    assert.equal(jwt.verify(token, secret).amount, 2)
    require('firebase-admin/auth')
  })
})

function loadCommonJs(filename: string, source: string, hookedRequire: (id: string) => unknown) {
  const module = { exports: {} as Record<string, unknown> }
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {\n${source}\n})`,
    { filename },
  ) as (
    exports: Record<string, unknown>,
    require: (id: string) => unknown,
    module: { exports: Record<string, unknown> },
    filename: string,
    dirname: string,
  ) => void
  wrapper(module.exports, hookedRequire, module, filename, path.dirname(filename))
  return module.exports as unknown as (algorithm: string) => {
    sign: (input: string, secret: string) => string
    verify: (input: string, signature: string, secret: string) => boolean
  }
}
