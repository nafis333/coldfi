import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedis } from '../services/redis';

const BLOCKED_IPS_KEY = 'admin:blocked_ips';

export async function ipBlocker(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const redis = getRedis();
    const ip = request.ip;
    const blocked = await redis.sismember(BLOCKED_IPS_KEY, ip);
    if (blocked) {
      reply.status(403).send({
        error: 'ERR_FORBIDDEN',
        message: 'Your IP has been blocked',
      });
      return;
    }
  } catch {
    // Redis unavailable — allow request through
  }
}
