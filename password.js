//// password -- hash passwords for storage and validate against them
///
/// This module will attempt to use bcrypt() to hash and validate
/// passwords.  If bcrypt isn't available, it falls back to sha512.
///
///   var assert = require('assert'),
///       pwd = require('password');
///
///   assert.ok(pwd.valid('foo', pwd.hash('foo')));
///
/// ## API ##
///
/// .hash(password)        return a hashed password that can be stored
/// .valid(password, hash) return true if password matches the hash.
/// .bcrypt.hash(password) return a hashed password using bcrypt
/// .sha512.hash(password) return a hashed password using sha512
/// .defaultMethod(name)   set the default hashing method
/// .defineCrypto(name)    add a hashing method supported by crypto
/// .define(name, methods) add a custom method
///

var sys = require('sys'),
    crypto = require('crypto'),
    bcrypt = maybeRequire('bcrypt_node');

exports.define = define;
exports.defaultMethod = defaultMethod;
// exports.hash is defined by define()
exports.valid = valid;
exports.defineCrypto = defineCrypto;
exports.encodeInt = encodeInt;

var SALT_SIZE = 10;


/// --- Generic methods

// Most recently defined hashing method is default.
function define(name, methods) {
  exports[name] = methods;
  defaultMethod(name);
}

function defaultMethod(name) {
  exports.hash = exports[name].hash;
}

function valid(password, hash) {
  var match = hash.match(/^{{([^}]+)}}/);

  if (!match)
    throw new Error('Unrecognized hash format.');

  var methods = exports[match[1]];
  if (!methods)
    throw new Error('Unrecognized hash method: "' + match[1] + '".');

  return methods.valid(password, hash);
}


/// --- Crypto

['sha512'].forEach(defineCrypto);

function defineCrypto(method) {
  define(method, {
    hash: function(password) {
      return cryptoHash(method, password, SALT_SIZE);
    },

    valid: cryptoValid
  });
}

function cryptoHash(method, password, saltSize) {
  return _cryptoHash(method, password, genSalt(saltSize));
}

function _cryptoHash(method, password, salt) {
  var hash = crypto.createHash(method);
  hash.update(password);
  hash.update(salt);
  return '{{' + method + '}}' + salt + '$' + hash.digest('base64').trim('=');
}

function cryptoValid(password, hash) {
  var match = hash.match(/^{{([^}]+)}}([^\$]+)\$(.*)$/);

  if (!match)
    throw new Error('Unrecognized cryptoHash format.');

  return hash == _cryptoHash(match[1], password, match[2]);
}

function genSalt(size) {
  return encodeInt(Math.floor(Math.random() * Math.exp(size)));
}


/// --- bcrypt

if (bcrypt)
  define('bcrypt', {
    hash: function(password) {
      var bc = new bcrypt.BCrypt();
      return '{{bcrypt}}' + bc.hashpw(password, bc.gen_salt(SALT_SIZE));
    },

    valid: function(password, hash) {
      var match = hash.match(/^{{bcrypt}}(.*)$/);

      if (!match)
        throw new Error('Unrecognized bcrypt format.');

      return (new bcrypt.BCrypt()).compare(password, match[1]);
    }
  });


/// --- Aux

// Encode a positive integer as a URI-safe string.
var encodeInt = (function() {
  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  return function encode(num) {
    var result = '';
    for(;;) {
      result += ALPHABET[num & 0x3f];
      num = num >> 6;
      if (num == 0) break;
    }
    return result;
  };
})();

function maybeRequire(name) {
  try {
    return require(name);
  } catch (exn) {
    if (!/Cannot find module/.test(exn.message))
      throw exn;
    return undefined;
  }
}