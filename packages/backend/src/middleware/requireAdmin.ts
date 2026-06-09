import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../errors';

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user || request.user.role !== 'owner') {
    throw new ForbiddenError('Admin access required');
  }
}
