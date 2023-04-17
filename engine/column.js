// File: column.js
import { UNIQUE_IDENTIFIER_SIZE } from './constants.js';
import { strHash } from './util.js';

/**
 * Enum for Column Types
 * @readonly
 * @enum {string}
 */
export const Types = Object.freeze({
  UniqueIdentifier: 'UniqueIdentifier',
  Text: 'Text',
  Number: 'Number',
  Boolean: 'Boolean',
  Date: 'Date',
  UpdatedAt: 'UpdatedAt',
  Buffer: 'Buffer',
  Coordinates: 'Coordinates',
});

export function getNanoseconds(dateMs = Date.now()) {
  const hrtimeInNs = process.hrtime.bigint();
  const dateNs = BigInt(dateMs) * BigInt(1000000);
  const dateInNs = dateNs + hrtimeInNs;

  // Calculate the remainder when dividing by 1 millisecond (in nanoseconds)
  const nsPerMillisecond = BigInt(1000000);
  const currentNanosecondsBigInt = dateInNs % nsPerMillisecond;

  // Convert BigInt to a Number (integer)
  return Number(currentNanosecondsBigInt);
}

/**
 * Generate a unique ID
 * @param {string[]} args - Additional arguments to include in the hash
 * @returns {string}
 */
export function uniqueId(...args) {
  const buffer = Buffer.alloc(UNIQUE_IDENTIFIER_SIZE);
  const hash = strHash(4, ...args);
  buffer.write(hash, 0, 4, 'hex');
  const nowInMs = Date.now();
  buffer.writeFloatBE(nowInMs, 4);
  const nowNs = getNanoseconds(nowInMs);
  buffer.writeFloatBE(nowNs, 8);

  return buffer.toString('hex');
}

/**
 * Parse a date from a unique ID
 * @param {string} id - The unique ID
 * @returns {Date}
 */
export function uniqueIdDate(id) {
  const buffer = Buffer.from(id, 'hex');
  let dateInMs = buffer.readFloatBE(4);
  return new Date(dateInMs);
}
