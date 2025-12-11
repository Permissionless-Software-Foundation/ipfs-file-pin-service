/*
  Unit tests for the User entity library.
*/

import { assert } from 'chai'

import sinon from 'sinon'
import LocalPins from '../../../src/entities/local-pins.js'

let sandbox
let uut

describe('#LocalPins-Entity', () => {
  before(async () => {})

  beforeEach(() => {
    uut = new LocalPins()

    sandbox = sinon.createSandbox()
  })

  afterEach(() => sandbox.restore())

  describe('#validate', () => {
    it('should throw an error if CID is not provided', () => {
      try {
        uut.validate()
      } catch (err) {
        assert.include(err.message, "Property 'CID' must be a string!")
      }
    })

    it('should throw an error if fileSize is not provided', () => {
      try {
        uut.validate({ CID: 'cid' })
      } catch (err) {
        assert.include(err.message, "Property 'fileSize' must be a number!")
      }
    })

    it('should throw an error if filename is not provided', () => {
      try {
        uut.validate({ CID: 'cid', fileSize: 1000 })
      } catch (err) {
        assert.include(err.message, "Property 'filename' must be a string!")
      }
    })

    it('should return a LocalPins object', () => {
      const inputData = {
        CID: 'cid',
        fileSize: 1000,
        filename: 'test.txt'
      }

      const entry = uut.validate(inputData)
      // console.log('entry: ', entry)

      assert.property(entry, 'CID')
      assert.equal(entry.CID, inputData.CID)

      assert.property(entry, 'fileSize')
      assert.equal(entry.fileSize, inputData.fileSize)

      assert.property(entry, 'filename')
      assert.equal(entry.filename, inputData.filename)
    })
  })
})
