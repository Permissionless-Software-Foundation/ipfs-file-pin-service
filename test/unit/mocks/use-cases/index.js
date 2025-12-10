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
}

class UseCasesMock {
  constuctor(localConfig = {}) {
    // this.user = new UserUseCaseMock(localConfig)
  }

  user = new UserUseCaseMock()
  ipfs = new IpfsUseCaseMock()
  usage = new UsageUseCaseMock()
}

export default UseCasesMock;
