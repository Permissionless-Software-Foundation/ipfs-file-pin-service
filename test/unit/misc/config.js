/*
  Unit tests for the config directory
*/

import { assert } from 'chai'

let currentEnv

describe('#config', () => {
  before(() => {
    // Backup the current environment setting.
    currentEnv = process.env.SVC_ENV
    // Clear SVC_ENV for the first test to ensure default behavior
    delete process.env.SVC_ENV
  })

  after(() => {
    // Restore the environment setting before starting these tests.
    if (currentEnv) {
      process.env.SVC_ENV = currentEnv
    } else {
      delete process.env.SVC_ENV
    }
  })

  it('Should return development environment config by default', async () => {
    // Ensure SVC_ENV is not set for this test
    delete process.env.SVC_ENV
    const importedConfig = await import('../../../config/index.js?foo=bar0')
    const config = importedConfig.default
    // console.log('config: ', config)

    assert.equal(config.env, 'dev')
  })

  it('Should return test environment config', async () => {
    // Hack to dynamically import a library multiple times:
    // https://github.com/denoland/deno/issues/6946

    process.env.SVC_ENV = 'test'

    const importedConfig2 = await import('../../../config/index.js?foo=bar1')
    const config = importedConfig2.default
    // console.log('config: ', config)

    assert.equal(config.env, 'test')
  })

  it('Should return prod environment config', async () => {
    process.env.SVC_ENV = 'prod'

    process.env.WALLET_INTERFACE = 'web2'
    process.env.APISERVER = 'https://api.fullstack.cash/v5/'

    await import('../../../config/env/common.js?foo=bar2')
    const importedConfig3 = await import('../../../config/index.js?foo=bar2')
    const config = importedConfig3.default
    // console.log('config: ', config)

    assert.equal(config.env, 'prod')
  })
})

describe('#config BOOTSTRAP_SERVERS', () => {
  // Two representative multiaddrs, kept here so each case stays readable.
  const PEER_1 =
    '/ip4/172.18.0.3/tcp/4101/p2p/12D3KooWDDrYph3KNxASGR5a4Bjw8thVTfK6MHiNCSz6GvygXwdR'
  const PEER_2 =
    '/ip4/143.198.134.59/tcp/4101/p2p/12D3KooWHogx3RcyNiSuY6SzS8GxzTAqtDCYzy17yQ1StWaLvX9j'

  let savedValues

  before(() => {
    savedValues = {
      BOOTSTRAP_SERVERS: process.env.BOOTSTRAP_SERVERS,
      STARTUP_PEERS: process.env.STARTUP_PEERS
    }
  })

  afterEach(() => {
    // Restore the original values so other tests are unaffected.
    for (const key of Object.keys(savedValues)) {
      if (savedValues[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = savedValues[key]
      }
    }
  })

  // Each case re-imports the module with a unique query string, because ESM
  // caches modules and the config is evaluated once at import time.
  const importConfig = (tag) => import(`../../../config/env/common.js?${tag}`)

  it('Should be undefined when BOOTSTRAP_SERVERS is unset', async () => {
    delete process.env.BOOTSTRAP_SERVERS
    delete process.env.STARTUP_PEERS

    const config = (await importConfig('bootstrap0')).default

    assert.equal(config.bootstrapPeers, undefined)
  })

  it('Should parse a single bootstrap server', async () => {
    process.env.BOOTSTRAP_SERVERS = PEER_1

    const config = (await importConfig('bootstrap1')).default

    assert.deepEqual(config.bootstrapPeers, [PEER_1])
  })

  it('Should split a comma-delimited list and trim whitespace', async () => {
    process.env.BOOTSTRAP_SERVERS = `${PEER_1}, ${PEER_2}`

    const config = (await importConfig('bootstrap2')).default

    assert.deepEqual(config.bootstrapPeers, [PEER_1, PEER_2])
  })

  it('Should ignore blank entries', async () => {
    process.env.BOOTSTRAP_SERVERS = `${PEER_1},,  ,`

    const config = (await importConfig('bootstrap3')).default

    assert.deepEqual(config.bootstrapPeers, [PEER_1])
  })

  it('Should be undefined for an empty/whitespace-only value', async () => {
    process.env.BOOTSTRAP_SERVERS = '   '

    const config = (await importConfig('bootstrap4')).default

    assert.equal(config.bootstrapPeers, undefined)
  })

  it('Should throw on a malformed multiaddr', async () => {
    process.env.BOOTSTRAP_SERVERS = '172.18.0.3:4101'

    let threw = false
    try {
      await importConfig('bootstrap5')
    } catch (err) {
      threw = true
      assert.include(err.message, 'BOOTSTRAP_SERVERS')
    }

    assert.equal(threw, true)
  })

  it('Should honour STARTUP_PEERS as a legacy alias', async () => {
    delete process.env.BOOTSTRAP_SERVERS
    process.env.STARTUP_PEERS = PEER_2

    const config = (await importConfig('bootstrap6')).default

    assert.deepEqual(config.bootstrapPeers, [PEER_2])
  })

  it('Should prefer BOOTSTRAP_SERVERS over the STARTUP_PEERS alias', async () => {
    process.env.BOOTSTRAP_SERVERS = PEER_1
    process.env.STARTUP_PEERS = PEER_2

    const config = (await importConfig('bootstrap7')).default

    assert.deepEqual(config.bootstrapPeers, [PEER_1])
  })
})
