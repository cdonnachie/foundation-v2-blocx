const hashing = require('bindings')('hashing.node');
const Autolykos2 = require('../../algorithms/autolykos2/AutolykosPowScheme');
const autolykos2 = new Autolykos2();

///////////////////////////////////////////////////////////////////////////////

// Main Algorithms Function
const Algorithms = {

  // Sha256d Algorithm
  'sha256d': {
    multiplier: 1,
    diff: parseInt('0x00000000ffff0000000000000000000000000000000000000000000000000000'),
    hash: function() {
      return function() {
        return hashing.sha256d.apply(this, arguments);
      };
    }    
  },

  // Autolykos2 Algorithm
  'autolykos2': {
    multiplier: 1,
    diff: parseInt('0x00000000ffff0000000000000000000000000000000000000000000000000000'),
    blake2b256: function(seed) {
      return autolykos2.blake2b256(seed);
    },
    autolykos2_hashes: function(headerBuffer, height) {
      return autolykos2.autolykos2_hashes(headerBuffer, height);
    }
  },
};

module.exports = Algorithms;
