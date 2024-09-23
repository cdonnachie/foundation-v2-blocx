const blake2b = require('blake2');
const uint64be = require('uint64be');
const BigIntBuffer = require('bigint-buffer');

class AutolykosPowScheme {
  constructor() {
    this.k = 32;
    this.n = 26;

    if (this.k > 32)
      throw new Error('k > 32 is not allowed due to genIndexes function');
    if (this.n >= 31) throw new Error('n >= 31 is not allowed');

    this.NBase = Math.pow(2, this.n);
    this.IncreaseStart = 600 * 1024;
    this.IncreasePeriodForN = 50 * 1024;
    this.NIncreasementHeightMax = 4198400;

    this.N = (height) => {
      height = Math.min(this.NIncreasementHeightMax, height);
      if (height < this.IncreaseStart) {
        return this.NBase;
      } else if (height >= this.NIncreasementHeightMax) {
        return 2147387550;
      } else {
        let res = this.NBase;
        const iterationsNumber =
          Math.floor((height - this.IncreaseStart) / this.IncreasePeriodForN) +
          1;
        for (let i = 0; i < iterationsNumber; i++) {
          res = (res / BigInt(100)) * BigInt(105);
        }
        return res;
      }
    };
  }

  /**
   * Autolykos2 hash function
   * @param {Buffer} serializedHeader - Buffer to hash
   * @param {number} height - Block height
   * @returns {string} - Hash as a hexadecimal string
   * @returns {Buffer} - Hash of the hash
   */
  autolykos2_hashes(coinbaseBuffer, height) {
    const M = Buffer.concat(
      Array(1024)
        .fill()
        .map((_, i) => uint64be.encode(i))
    );

    const h = BigIntBuffer.toBufferBE(BigInt(height), 4);
    const i = BigIntBuffer.toBufferBE(
      BigIntBuffer.toBigIntBE(this.blake2b256(coinbaseBuffer).slice(24, 32)) %
        BigInt(this.N(height)),
      4
    );
    const e = this.blake2b256(Buffer.concat([i, h, M])).slice(1, 32);
    const J = this.genIndexes(Buffer.concat([e, coinbaseBuffer]), height).map(
      (item) => BigIntBuffer.toBufferBE(BigInt(item), 4)
    );
    const f = J.map((item) =>
      BigIntBuffer.toBigIntBE(
        this.blake2b256(Buffer.concat([item, h, M])).slice(1, 32)
      )
    ).reduce((a, b) => a + b);

    //let hashValue = Buffer.alloc(32);
    const hash = BigIntBuffer.toBufferBE(f, 32);
    return this.blake2b256(hash);
  }

  /**
   * Generate indexes
   * @param {Buffer} seed - Seed buffer
   * @param {number} height - Block height
   * @returns {Array} - Array of indexes
   */
  genIndexes(seed, height) {
    const hash = this.blake2b256(seed);
    const extendedHash = new Uint8Array(hash.length * 2);
    extendedHash.__proto__ = hash.__proto__;
    extendedHash.set(hash);
    extendedHash.set(hash, hash.length);
    return Array.from({ length: 32 }).map(
      (_, index) => extendedHash.readUIntBE(index, 4) % parseInt(this.N(height))
    );
  }

  /**
   * Blake2b256 hash function
   * @param {Buffer | string} seed - Seed buffer or string
   * @returns {Buffer} - Hash of the seed
   */
  blake2b256(seed) {
    if (typeof seed === 'string') {
      seed = Buffer.from(seed, 'utf-8');
    }
    const h = blake2b.createHash('blake2b', { digestLength: 32 });
    h.update(seed);
    return h.digest();
  }
}
module.exports = AutolykosPowScheme;
