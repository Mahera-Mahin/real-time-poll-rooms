import { createHash } from 'crypto';

export function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? 'poll-rooms-default-salt';
  return createHash('sha256').update(ip + salt).digest('hex');
}
