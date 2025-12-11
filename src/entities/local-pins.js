/*
  Local Pins Entity
*/

class LocalPins {
  validate ({ CID, fileSize, filename } = {}) {
    // Input Validation
    if (!CID || typeof CID !== 'string') {
      throw new Error("Property 'CID' must be a string!")
    }
    if (!fileSize || typeof fileSize !== 'number') {
      throw new Error("Property 'fileSize' must be a number!")
    }
    if (!filename || typeof filename !== 'string') {
      throw new Error("Property 'filename' must be a string!")
    }

    const localPinsData = { CID, fileSize, filename }
    // console.log('localPinsData: ', localPinsData)
    return localPinsData
  }
}

export default LocalPins
