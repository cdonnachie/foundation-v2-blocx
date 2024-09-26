const Algorithms = require('./algorithms');
const Transactions = require('./transactions');
const utils = require('./utils');
const fastRoot = require('merkle-lib/fastRoot');
const crypto = require('crypto');

////////////////////////////////////////////////////////////////////////////////

// Main Template Function
const Template = function(jobId, config, rpcData, placeholder) {

  const _this = this;
  this.jobId = jobId;
  this.config = config;
  this.rpcData = rpcData;
  this.submissions = [];

  // Template Variables
  this.target = _this.rpcData.target ? BigInt(`0x${ _this.rpcData.target }`) : utils.bigIntFromBitsHex(_this.rpcData.bits);
  this.difficulty = parseFloat((Algorithms.autolykos2.diff / Number(_this.target)).toFixed(9));
  this.previous = utils.reverseByteOrder(Buffer.from(_this.rpcData.previousblockhash, 'hex')).toString('hex');
  this.generation = new Transactions(config, rpcData).handleGeneration(placeholder);
  this.steps = utils.getMerkleSteps(_this.rpcData.transactions);

  // Manage Serializing Block Headers
  this.handleHeader = function(merkleRoot, nonce) {
    // Initialize Header/Pointer
    let position = 0;
    let header = Buffer.alloc(80);
  
    if (nonce !== undefined) {
      header = Buffer.alloc(92);
    }
  
    // Append Data to Buffer
    header.writeUInt32BE(_this.rpcData.height, position); // Height (4 bytes)
    position += 4;
  
    if (nonce !== undefined) {
      header.write(nonce, position, 'hex'); // Nonce (8 bytes in hex)
      position += 8;
      header.write('00000000', position, 'hex'); // Padding (4 bytes)
      position += 4;
    }
  
    header.writeUInt32BE(parseInt(_this.rpcData.bits, 16), position); // Bits (4 bytes, hex parsed to integer)
    position += 4;

    header.writeUInt32BE(_this.rpcData.curtime, position); // Time (4 bytes)
    position += 4;
  
    // Merkle Root (32 bytes, hex string)
    Buffer.from(utils.reverseBuffer(merkleRoot)).copy(header, position);
    position += 32;
  
    // Previous Block Hash (32 bytes, hex string)
    Buffer.from(_this.rpcData.previousblockhash, 'hex').copy(header, position);
    position += 32;
  
    header.writeUInt32BE(5, position); // Version (4 bytes)
  
    header = utils.reverseBuffer(header); // Reverse the header
  
    return header;
  };

  // Manage Serializing Block Coinbase
  this.handleCoinbase = function(extraNonce1, extraNonce2) {
    return Buffer.concat([
      _this.generation[0],
      extraNonce1,
      extraNonce2,
      _this.generation[1],
    ]);
  };

  // Manage Serializing Block Objects
  this.handleBlocks = function(header, coinbase) {
    return Buffer.concat([
      header,
      utils.varIntBuffer(_this.rpcData.transactions.length + 1),
      coinbase,
      Buffer.concat(_this.rpcData.transactions.map((tx) => Buffer.from(tx.data, 'hex'))),
    ]);
  };

  // Manage Job Parameters for Clients
  this.handleParameters = function(client, cleanJobs) {
    // Check if Client has ExtraNonce Set
    if (!client.extraNonce1) {
      client.extraNonce1 = utils.extraNonceCounter(2).next();
    }

    // Establish Hashing Algorithms
    //const headerDigest = Algorithms.sha256d.hash();
    const coinbaseDigest = Algorithms.sha256d.hash();
    const extraNonce1Buffer = Buffer.from(client.extraNonce1, 'hex');
    const randomNonce2Buffer = Buffer.alloc(6);
    crypto.randomFillSync(randomNonce2Buffer);
    client.randomNonce2Buffer = randomNonce2Buffer.toString('hex');

    // Generate Coinbase Buffer
    const coinbaseBuffer = _this.handleCoinbase(extraNonce1Buffer, randomNonce2Buffer);
    const coinbaseHash = coinbaseDigest(coinbaseBuffer);
    const hashes = utils.convertHashToBuffer(_this.rpcData.transactions);
    const transactions = [coinbaseHash].concat(hashes);
    const merkleRoot = fastRoot(transactions, utils.sha256d);
    const headerWithoutNonce = _this.handleHeader(merkleRoot);
    client.merkleRoot = merkleRoot.toString('hex');
    client.msg = Algorithms.autolykos2.blake2b256(headerWithoutNonce.toString('hex')).toString('hex');
    
    return [
      _this.jobId,
      client.msg,
      _this.rpcData.height,
      cleanJobs
    ];    

  };

  // Check Previous Submissions for Duplicates
  this.handleSubmissions = function(header) {
    const submission = header.join('').toLowerCase();
    if (_this.submissions.indexOf(submission) === -1) {
      _this.submissions.push(submission);
      return true;
    }
    return false;
  };
};

module.exports = Template;
