/*
  Unit tests for the users Mongoose model.
*/

import { assert } from 'chai'

import sinon from 'sinon'
import mongoose from 'mongoose'

import User from '../../../src/adapters/localdb/models/users.js'
import config from '../../../config/index.js'

// Set the environment variable to signal this is a test.
process.env.SVC_ENV = 'test'

describe('#User-Adapter', () => {
  // let uut
  let sandbox
  let testuser

  before(async () => {
    // Connect to the Mongo Database.
    console.log(`Connecting to database: ${config.database}`)
    mongoose.Promise = global.Promise
    await mongoose.connect(config.database)

    // Prune any leftover user document from a previous interrupted run. Without
    // this, a stale 'test983@test.com' doc causes an E11000 duplicate key error.
    await User.deleteMany({ email: 'test983@test.com' })

    testuser = new User({
      email: 'test983@test.com',
      name: 'test983',
      password: 'password'
    })
  })

  beforeEach(async () => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => sandbox.restore())

  after(async () => {
    await testuser.deleteOne()

    mongoose.connection.close()
  })

  describe('#save', () => {
    it('should replace the password with a salt', async () => {
      await testuser.save()
      // console.log('testuser: ', testuser)

      assert.notEqual(testuser.password, 'password')
    })
    it('should ignore password encrption if password property is not provided', async () => {
      const lastPassword = testuser.password
      await testuser.save()
      // console.log('testuser: ', testuser)

      assert.equal(testuser.password, lastPassword)
    })
  })

  describe('#validatePassword', () => {
    it('should return true when password matches', async () => {
      const result = await testuser.validatePassword('password')
      // console.log('result: ', result)

      assert.equal(result, true)
    })

    it('should return false when password does not match', async () => {
      const result = await testuser.validatePassword('wrongpassword')
      // console.log('result: ', result)

      assert.equal(result, false)
    })
  })

  describe('#generateToken', () => {
    it('should generate a JWT token', () => {
      const token = testuser.generateToken()
      // console.log('token: ', token)

      assert.include(token, 'eyJ')
    })
  })
})
