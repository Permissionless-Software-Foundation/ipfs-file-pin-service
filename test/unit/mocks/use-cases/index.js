/*
  Mocks for the use cases.
*/
/* eslint-disable */

class UserUseCaseMock {
  async createUser(userObj) {
    return {}
  }

  async getAllUsers() {
    return true
  }

  async getUser(params) {
    return true
  }

  async updateUser(existingUser, newData) {
    return true
  }

  async deleteUser(user) {
    return true
  }

  async authUser(login, passwd) {
    return {
      generateToken: () => {}
    }
  }
}

class IpfsUseCaseMock {
  async processPinClaim () {
    return true
  }

  async pinCid() {
    return true
  }

  async getPinStatus() {
    return true
  }

  async downloadFile() {
    return true
  }
  async downloadCid() {
    return true
  }

  async getPinClaims() {
    return true
  }

  async pinCidForTimerController() {
    return true
  }

  async getWritePrice() {
    return 0.08
  }
  async pinLocalFile() {
    return {}
  }
  getUnprocessedPins() {
    return true
  }
}

class UsageUseCaseMock {
  async cleanUsage() {
    return {}
  }

  async getRestSummary() {
    return true
  }

  async getTopIps(params) {
    return true
  }

  async getTopEndpoints(existingUser, newData) {
    return true
  }

  async clearUsage() {
    return true
  }

  async saveUsage() {
    return true
  }
}

class LocalUseCaseMock {
  async getAll () {
    return []
  }

  async deleteByCid () {
    return { CID: 'testCid', filename: 'test.txt', fileSize: 100 }
  }
}

class UseCasesMock {
  constuctor(localConfig = {}) {
    // this.user = new UserUseCaseMock(localConfig)
  }

  user = new UserUseCaseMock()
  ipfs = new IpfsUseCaseMock()
  usage = new UsageUseCaseMock()
  local = new LocalUseCaseMock()
}

export default UseCasesMock;
