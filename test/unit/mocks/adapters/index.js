/*
  Mocks for the Adapter library.
*/

async function* asyncGenerator1() {
  yield Buffer.from('0x01', "hex")
  yield Buffer.from('0x02', "hex")
}

async function* asyncGenerator2() {
  yield { path: 'test' }
}

class IpfsAdapter {
  constructor() {
    this.ipfs = {
      files: {
        stat: () => { }
      },
      pins: {
        // Async iterator mock function
        add: async function* () {
          yield 'result cid'
        },
        rm: async () => { }
      },
      fs: {
        addFile: async () => { return 'cid' },
        stat: async () => { },
        cat: () => asyncGenerator1(),
        ls: () => asyncGenerator2()
      },
      blockstore: {
        get: async () => { },
        delete: async () => { }
      }
    }
  }
}

class IpfsCoordAdapter {
  constructor() {
    this.ipfsCoord = {
      adapters: {
        ipfs: {
          connectToPeer: async () => { }
        }
      },
      useCases: {
        peer: {
          sendPrivateMessage: () => { }
        }
      },
      thisNode: {}
    }
  }
}

const ipfs = {
  ipfsAdapter: new IpfsAdapter(),
  ipfsCoordAdapter: new IpfsCoordAdapter(),
  getStatus: async () => { },
  getPeers: async () => { },
  getRelays: async () => { }
}
ipfs.ipfs = ipfs.ipfsAdapter.ipfs

const localdb = {
  Users: class Users {
    static findById() { }
    static find() { }
    static findOne() {
      return {
        validatePassword: localdb.validatePassword
      }
    }

    async save() {
      return {}
    }

    generateToken() {
      return '123'
    }

    toJSON() {
      return {}
    }

    async remove() {
      return true
    }

    async validatePassword() {
      return true
    }
  },

  validatePassword: () => {
    return true
  },

  Pins: class Pins {
    static findById() { }
    static find() { }
    static findOne() {
      return {
        validatePassword: localdb.validatePassword
      }
    }

    async save() {
      return {}
    }

    generateToken() {
      return '123'
    }

    toJSON() {
      return {}
    }

    async remove() {
      return true
    }

    async validatePassword() {
      return true
    }
  },
  LocalPins: class LocalPins {
    static findById () {}
    static find () {}
    static findOne () {

    }

    async save () {
      return {}
    }

    generateToken () {
      return '123'
    }

    toJSON () {
      return {}
    }

    async remove () {
      return true
    }

    async validatePassword () {
      return true
    }
    static async deleteMany(){
      return true
    }
  },

  Usage: class Usage {
    static findById () {}
    static find () {}
    static findOne () {
      return {
        validatePassword: localdb.validatePassword
      }
    }

    async save () {
      return {}
    }

    generateToken () {
      return '123'
    }

    toJSON () {
      return {}
    }

    async remove () {
      return true
    }

    async validatePassword () {
      return true
    }
    static async deleteMany(){
      return true
    }
  },

  validatePassword: () => {
    return true
  }
}

export default { ipfs, localdb };
