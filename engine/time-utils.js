/**
 * TimeUtils - Handles time and date utilities
 */

/**
 * Get nanoseconds component from a timestamp
 * @param {number} dateMs - Date in milliseconds (defaults to Date.now())
 * @returns {number} Nanoseconds component (0-999999)
 */
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
 * Get high-resolution timestamp with nanosecond precision
 * @returns {bigint} High-resolution timestamp in nanoseconds
 */
export function getHighResTime() {
  return process.hrtime.bigint();
}

/**
 * Convert nanoseconds to milliseconds
 * @param {bigint} nanoseconds - Nanoseconds value
 * @returns {number} Milliseconds value
 */
export function nanosecondsToMilliseconds(nanoseconds) {
  return Number(nanoseconds / BigInt(1000000));
}

/**
 * Convert milliseconds to nanoseconds
 * @param {number} milliseconds - Milliseconds value
 * @returns {bigint} Nanoseconds value
 */
export function millisecondsToNanoseconds(milliseconds) {
  return BigInt(milliseconds) * BigInt(1000000);
}

/**
 * Format a duration in milliseconds to human-readable string
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Human-readable duration string
 */
export function formatDuration(milliseconds) {
  if (milliseconds < 1) {
    return `${(milliseconds * 1000).toFixed(2)}μs`;
  } else if (milliseconds < 1000) {
    return `${milliseconds.toFixed(2)}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Create a performance timer
 * @returns {object} Timer object with start and elapsed methods
 */
export function createTimer() {
  const startTime = process.hrtime.bigint();
  
  return {
    /**
     * Get elapsed time in milliseconds
     * @returns {number} Elapsed time in milliseconds
     */
    elapsed() {
      const endTime = process.hrtime.bigint();
      return nanosecondsToMilliseconds(endTime - startTime);
    },
    
    /**
     * Get elapsed time in nanoseconds
     * @returns {bigint} Elapsed time in nanoseconds
     */
    elapsedNs() {
      const endTime = process.hrtime.bigint();
      return endTime - startTime;
    },
    
    /**
     * Get formatted elapsed time
     * @returns {string} Human-readable elapsed time
     */
    elapsedFormatted() {
      return formatDuration(this.elapsed());
    }
  };
}