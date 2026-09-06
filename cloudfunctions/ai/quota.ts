import { createHash } from 'node:crypto';

export const MINUTE_LIMIT = 6;
export const DAY_LIMIT = 50;
export const CLAIM_STALE_MS = 90_000;
export const RETRY_COOLDOWN_MS = 1_000;
export const MAX_LOGICAL_ATTEMPTS = 2;

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function shanghaiDay(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function quotaWindows(ownerId: string, now: Date) {
  const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString();
  const dayStart = shanghaiDay(now);
  return [
    {
      id: digest(`usage\u0000${ownerId}\u0000minute\u0000${minuteStart}`),
      ownerId,
      windowType: 'minute' as const,
      windowStart: minuteStart,
      limit: MINUTE_LIMIT,
      expiresAt: new Date(now.getTime() + 2 * 60 * 60_000).toISOString(),
    },
    {
      id: digest(`usage\u0000${ownerId}\u0000day\u0000${dayStart}`),
      ownerId,
      windowType: 'day' as const,
      windowStart: dayStart,
      limit: DAY_LIMIT,
      expiresAt: new Date(now.getTime() + 32 * 24 * 60 * 60_000).toISOString(),
    },
  ];
}
