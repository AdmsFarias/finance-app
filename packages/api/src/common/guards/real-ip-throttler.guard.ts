import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard variant that derives the rate-limit key from the originating client IP
 * (first hop in `X-Forwarded-For`, then `X-Real-IP`, then the socket IP) instead of the
 * direct connection IP. This is needed because the Next BFF funnels every server-side
 * call through the same loopback connection — without forwarded-IP awareness, all users
 * share a single throttle bucket.
 *
 * No allowlist of trusted proxies is enforced: in V1 the API is only reachable through
 * the BFF, which is the sole component setting these headers. Tighten this if the API
 * ever gets exposed publicly.
 */
@Injectable()
export class RealIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = pickHeader(req.headers?.['x-forwarded-for']);
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = pickHeader(req.headers?.['x-real-ip']);
    if (realIp) return realIp;
    return typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : 'unknown';
  }
}

function pickHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
