import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminRateLimit } from '../adminRateLimit';

const redisMap = new Map<string, number>();

vi.mock('../../services/redis', () => ({
  getRedis: () => ({
    incr: async (key: string) => {
      const val = (redisMap.get(key) ?? 0) + 1;
      redisMap.set(key, val);
      return val;
    },
    expire: async () => {},
    ttl: async () => 1,
  }),
}));

vi.mock('../../db/pool', () => ({
  query: vi.fn(),
}));

function createMockRequest(method: string, ip: string = '127.0.0.1') {
  return {
    ip,
    method,
  } as any;
}

function createMockReply() {
  const reply: any = {
    _status: 200,
    _headers: {} as Record<string, string>,
    _body: null as any,
    header(key: string, value: string) { this._headers[key] = value; return this; },
    status(code: number) { this._status = code; return this; },
    send(body: any) { this._body = body; return this; },
  };
  return reply;
}

describe('adminRateLimit', () => {
  beforeEach(() => {
    redisMap.clear();
    vi.stubGlobal('Date', Date);
  });

  it('should allow first request', async () => {
    const req = createMockRequest('GET');
    const reply = createMockReply();
    await adminRateLimit(req, reply);
    expect(reply._status).toBe(200);
  });

  it('should allow GET requests under limit', async () => {
    const req = createMockRequest('GET', '10.0.0.1');
    for (let i = 0; i < 199; i++) {
      await adminRateLimit(req, createMockReply());
    }
    const reply = createMockReply();
    await adminRateLimit(req, reply);
    expect(reply._status).toBe(200);
  });

  it('should block GET requests over limit', async () => {
    const req = createMockRequest('GET', '10.0.0.2');
    for (let i = 0; i < 200; i++) {
      await adminRateLimit(req, createMockReply());
    }
    const reply = createMockReply();
    await adminRateLimit(req, reply);
    expect(reply._status).toBe(429);
    expect(reply._body.error).toBe('ERR_ADMIN_RATE_LIMIT');
  });

  it('should apply lower limit for write requests', async () => {
    const req = createMockRequest('POST', '10.0.0.3');
    for (let i = 0; i < 50; i++) {
      await adminRateLimit(req, createMockReply());
    }
    const reply = createMockReply();
    await adminRateLimit(req, reply);
    expect(reply._status).toBe(429);
  });

  it('should return Retry-After header on block', async () => {
    const req = createMockRequest('GET', '10.0.0.4');
    for (let i = 0; i < 201; i++) {
      await adminRateLimit(req, createMockReply());
    }
    const reply = createMockReply();
    await adminRateLimit(req, reply);
    expect(reply._headers['Retry-After']).toBeDefined();
  });

  it('should have different limit for DELETE requests', async () => {
    const req = createMockRequest('DELETE', '10.0.0.5');
    for (let i = 0; i < 50; i++) {
      await adminRateLimit(req, createMockReply());
    }
    const reply = createMockReply();
    await adminRateLimit(req, reply);
    expect(reply._status).toBe(429);
  });
});
