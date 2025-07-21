import crypto from 'node:crypto';

export function strHash(length: number, ...args: string[]): string {
  const hash = crypto.createHash('shake256', { outputLength: length });
  if (!args?.length) {
    hash.update(crypto.randomBytes(length).toString('hex'));
  } else {
    for (const arg of args) {
      hash.update(arg);
    }
  }
  return hash.digest('hex');
}
