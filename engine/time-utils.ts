/**
 * TimeUtils - Handles time and date utilities
 */

/**
 * Timer interface for performance measurement
 */
export interface Timer {
  elapsed(): number;
  elapsedNs(): bigint;
  elapsedFormatted(): string;
}

/**
 * Get nanoseconds component from a timestamp
 */
export function getNanoseconds(dateMs: number = Date.now()): number {
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
 */
export function getHighResTime(): bigint {
  return process.hrtime.bigint();
}

/**
 * Convert nanoseconds to milliseconds
 */
export function nanosecondsToMilliseconds(nanoseconds: bigint): number {
  return Number(nanoseconds / BigInt(1000000));
}

/**
 * Convert milliseconds to nanoseconds
 */
export function millisecondsToNanoseconds(milliseconds: number): bigint {
  return BigInt(milliseconds) * BigInt(1000000);
}

/**
 * Format a duration in milliseconds to human-readable string
 */
export function formatDuration(milliseconds: number): string {
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
 */
export function createTimer(): Timer {
  const startTime = process.hrtime.bigint();
  
  return {
    /**
     * Get elapsed time in milliseconds
     */
    elapsed(): number {
      const endTime = process.hrtime.bigint();
      return nanosecondsToMilliseconds(endTime - startTime);
    },
    
    /**
     * Get elapsed time in nanoseconds
     */
    elapsedNs(): bigint {
      const endTime = process.hrtime.bigint();
      return endTime - startTime;
    },
    
    /**
     * Get formatted elapsed time
     */
    elapsedFormatted(): string {
      return formatDuration(this.elapsed());
    }
  };
}