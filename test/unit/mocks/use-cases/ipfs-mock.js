/*
  Mock data for IPFS Use Case unit tests.
*/

const pobValidTxDetails01 = {
  txid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
  hash: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
  version: 2,
  size: 470,
  locktime: 0,
  vin: [
    {
      txid: '04ce0467e9cff231e85d60afa35df677d313875906426be0c11f7a59f5c5008e',
      vout: 1,
      scriptSig: [Object],
      sequence: 4294967295,
      address: 'bitcoincash:qqkg30ryje97al52htqwvveha538y7gttywut3cdqv',
      value: 0.00000546,
      tokenQtyStr: '3.99931604',
      tokenQty: 3.99931604,
      tokenId: '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'
    },
    {
      txid: '04ce0467e9cff231e85d60afa35df677d313875906426be0c11f7a59f5c5008e',
      vout: 3,
      scriptSig: [Object],
      sequence: 4294967295,
      address: 'bitcoincash:qqkg30ryje97al52htqwvveha538y7gttywut3cdqv',
      value: 0.00005297,
      tokenQtyStr: 'NaN',
      tokenQty: null,
      tokenId: '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'
    }
  ],
  vout: [
    {
      value: 0,
      n: 0,
      scriptPubKey: [Object],
      tokenQty: null,
      tokenQtyStr: null
    },
    {
      value: 0.00000546,
      n: 1,
      scriptPubKey: [Object],
      tokenQtyStr: '3.91596371',
      tokenQty: 3.91596371
    },
    {
      value: 0.00002,
      n: 2,
      scriptPubKey: [Object],
      tokenQty: null,
      tokenQtyStr: null
    },
    {
      value: 0.00002454,
      n: 3,
      scriptPubKey: [Object],
      tokenQty: null,
      tokenQtyStr: null
    }
  ],
  hex: '02000000028e00c5f5597a1fc1e06b4206598713d377f65da3af605de831f2cfe96704ce04010000006a4730440220060a3ba48663393e8c392e740dcbbbdb513b4e3f39f64d579576cf3d5ba841ee02204d3f531eb8986b5316ad3ba5f022abf86d5621e0654bc25b64b2f9a03247d683412103f53bbb3db54948e111c3399a8b2c513b7458c089b126505a155f7fe914572c83ffffffff8e00c5f5597a1fc1e06b4206598713d377f65da3af605de831f2cfe96704ce04030000006a473044022052a3aa08b360fac82e504fdf4bbe534176b746ff116c7f32bcdfaaf51bfc229b02201321f1795af36b0b7f50ba463b8a09c565e36b38429bd3f0a5c615543b61bdb6412103f53bbb3db54948e111c3399a8b2c513b7458c089b126505a155f7fe914572c83ffffffff040000000000000000376a04534c500001010453454e442038e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b008000000001757495322020000000000001976a9142c88bc64964beefe8abac0e63337ed2272790b5988acd0070000000000001976a914203b64bfbaa9e58333295b621159ddebc591ecb188ac96090000000000001976a9142c88bc64964beefe8abac0e63337ed2272790b5988ac00000000',
  blockheight: 825463,
  isSlpTx: true,
  tokenTxType: 'SEND',
  tokenId: '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0',
  tokenType: 1,
  tokenTicker: 'PSF',
  tokenName: 'Permissionless Software Foundation',
  tokenDecimals: 8,
  tokenUri: 'psfoundation.cash',
  tokenDocHash: '',
  isValidSlp: true
}


const claimValidTxDetails01 = {
  txid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
  hash: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
  version: 2,
  size: 300,
  locktime: 0,
  vin: [
    {
      txid: 'a73c26e7dc3151cfc1be195fbcea52c9c9824d0498f131a6ae5fe7dc76b2d941',
      vout: 1,
      scriptSig: [Object],
      sequence: 4294967295,
      address: 'bitcoincash:qqkg30ryje97al52htqwvveha538y7gttywut3cdqv',
      value: 0.00215482
    }
  ],
  vout: [
    { value: 0, n: 0, scriptPubKey: [Object] },
    { value: 0.00214982, n: 1, scriptPubKey: [Object] }
  ],
  hex: '020000000141d9b276dce75faea631f198044d82c9c952eabc5f19bec1cf5131dce7263ca7010000006b483045022100c0f1a2063c92a867ae4ed0d93ed77ebffaf4f29e86418f6bfba946af888ab6a8022036e7f64e198fa5bcb78bd54d54393c425f3eb5f3826d294e33f927d91c0c8ded412103f53bbb3db54948e111c3399a8b2c513b7458c089b126505a155f7fe914572c83ffffffff020000000000000000636a0400510000205bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b237663b6261667962656963643435356c3763366d78696f677074716367366d64343734716d7a7a6d7a6f62677a753476666d7334776e656b326878677579c6470300000000001976a9142c88bc64964beefe8abac0e63337ed2272790b5988ac00000000',
  blockhash: '000000000000000001130367df363e416850c4d1dffd244685da52e524f0f398',
  confirmations: 470,
  time: 1703639914,
  blocktime: 1703639914,
  isValidSlp: false
}

// PS010 v2.0.0: the payout address that the mock claims pay.
export const PAYOUT_ADDRESS = 'bitcoincash:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr'

// Another valid BCH address, used as the "change" / wrong-address output.
export const OTHER_ADDRESS = 'bitcoincash:qqkg30ryje97al52htqwvveha538y7gttywut3cdqv'

// A BCH payment TX that pays the payout address in two outputs (multiple
// payout outputs must all count) and sends change elsewhere.
// Paid to payout: 2000 + 1000 = 3000 sats.
const paymentValidTxDetails = {
  txid: 'f5e4b4b7df7b1bdd8f0a5a1b3f6b7e8d9c0a1b2c3d4e5f60718293a4b5c6d7e8',
  hash: 'f5e4b4b7df7b1bdd8f0a5a1b3f6b7e8d9c0a1b2c3d4e5f60718293a4b5c6d7e8',
  version: 2,
  size: 226,
  locktime: 0,
  vin: [
    {
      txid: 'aa11bb22cc33dd44ee55ff6600112233445566778899aabbccddeeff00112233',
      vout: 0,
      scriptSig: { asm: 'OP_CHECKSIG', hex: '00' },
      sequence: 4294967295,
      address: 'bitcoincash:qz4r0e5c5x7w8p9q0r1s2t3u4v5w6x7y8z9q0r1s2t',
      value: 0.005
    }
  ],
  vout: [
    {
      value: 0.00002, // 2000 sats
      n: 0,
      scriptPubKey: {
        asm: 'OP_DUP OP_HASH160 efb0b43fb6c6afb927cdb90e98409acdec16e12f OP_EQUALVERIFY OP_CHECKSIG',
        hex: '76a914efb0b43fb6c6afb927cdb90e98409acdec16e12f88ac',
        reqSigs: 1,
        type: 'pubkeyhash',
        addresses: [PAYOUT_ADDRESS]
      }
    },
    {
      value: 0.00001, // 1000 sats, second output to the same payout address
      n: 1,
      // psf-slp-indexer reports the address here, not in scriptPubKey.
      address: 'qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr'
    },
    {
      value: 0.0048, // change, must not count
      n: 2,
      scriptPubKey: {
        asm: 'OP_DUP OP_HASH160 20a70fb7feba29940d20f6129119cc80c10ce3e3 OP_EQUALVERIFY OP_CHECKSIG',
        hex: '76a91420a70fb7feba29940d20f6129119cc80c10ce3e388ac',
        reqSigs: 1,
        type: 'pubkeyhash',
        addresses: [OTHER_ADDRESS]
      }
    }
  ],
  blockheight: 850000,
  confirmations: 3,
  isSlpTx: false,
  isValidSlp: false
}

// A BCH payment TX that pays only other addresses (F2/F6).
const paymentWrongAddressTxDetails = {
  txid: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
  hash: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
  version: 2,
  size: 226,
  locktime: 0,
  vin: [
    {
      txid: 'aa11bb22cc33dd44ee55ff6600112233445566778899aabbccddeeff00112233',
      vout: 0,
      scriptSig: { asm: 'OP_CHECKSIG', hex: '00' },
      sequence: 4294967295,
      address: 'bitcoincash:qqkg30ryje97al52htqwvveha538y7gttywut3cdqv',
      value: 0.005
    }
  ],
  vout: [
    {
      value: 0.00002,
      n: 0,
      scriptPubKey: {
        asm: 'OP_DUP OP_HASH160 20a70fb7feba29940d20f6129119cc80c10ce3e3 OP_EQUALVERIFY OP_CHECKSIG',
        hex: '76a91420a70fb7feba29940d20f6129119cc80c10ce3e388ac',
        reqSigs: 1,
        type: 'pubkeyhash',
        addresses: [OTHER_ADDRESS]
      }
    }
  ],
  blockheight: 850001,
  confirmations: 0,
  isSlpTx: false,
  isValidSlp: false
}

export default {
  pobValidTxDetails01,
  claimValidTxDetails01,
  paymentValidTxDetails,
  paymentWrongAddressTxDetails,
  PAYOUT_ADDRESS,
  OTHER_ADDRESS
}
