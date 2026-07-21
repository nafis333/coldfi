import { FastifyRequest, FastifyReply } from 'fastify';
import { GroupError } from '../errors';

export async function requireGroupAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.memberInfo || request.memberInfo.role !== 'admin') {
    throw new GroupError('ERR_NOT_ADMIN', 'Admin access required');
  }
}
