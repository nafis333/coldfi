import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as groupService from '../services/groupService';
import { emitToGroup, evictUserFromGroup } from '../plugins/websocket';
import { requireGroupAccess, requireGroupAdmin } from '../middleware';
import { createRateLimiter } from '../middleware/rateLimiter';

const encryptionKeyLimiter = createRateLimiter({
  windowSeconds: 60,
  maxAttempts: 60,
  keyPrefix: 'rl:encryption-key',
  keyFn: (req) => req.user?.userId || req.ip,
});

export async function groupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const groups = await groupService.listUserGroups(userId);
    return reply.send({ groups });
  });

  app.get('/:groupId', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as any;
    const group = await groupService.getGroupDetail(groupId, userId);
    return reply.send(group);
  });

  app.get('/invite/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.params as { code: string };
    const group = await groupService.lookupInvite(code);
    return reply.send(group);
  });

  app.post('/create', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          defaultCurrency: { type: 'string', minLength: 3, maxLength: 3 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { name, defaultCurrency = 'BDT' } = request.body as any;

    const result = await groupService.createGroup(name, defaultCurrency, userId);

    try { emitToGroup(result.groupId, 'group-created', { groupId: result.groupId, name: result.name, createdBy: userId }); } catch {}

    return reply.status(201).send(result);
  });

  app.post('/:groupId/invites', {
    preHandler: [requireGroupAccess, requireGroupAdmin],
    schema: {
      body: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = request.params as { groupId: string };
    const userId = request.user.userId;

    const invite = await groupService.createInvite(groupId, userId);
    return reply.status(201).send(invite);
  });

  app.get('/:groupId/invites', { preHandler: [requireGroupAccess, requireGroupAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = request.params as { groupId: string };

    const invites = await groupService.getInvites(groupId);
    return reply.send({ invites });
  });

  app.delete('/:groupId/invites/:inviteId', { preHandler: [requireGroupAccess, requireGroupAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId, inviteId } = request.params as { groupId: string; inviteId: string };

    await groupService.revokeInvite(inviteId, groupId);
    return reply.send({ success: true });
  });

  app.post('/join', {
    schema: {
      body: {
        type: 'object',
        required: ['inviteCode'],
        properties: {
          inviteCode: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { inviteCode } = request.body as { inviteCode: string };

    const result = await groupService.joinGroup(inviteCode, userId);

    try { emitToGroup(result.groupId, 'member-joined', { groupId: result.groupId, userId, memberIndex: result.memberIndex, role: 'member' }); } catch {}

    return reply.status(201).send({
      groupId: result.groupId,
      memberIndex: result.memberIndex,
      role: 'member',
    });
  });

  app.get('/:groupId/balance-summary', { preHandler: [requireGroupAccess] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };

    const result = await groupService.getBalanceSummary(groupId, userId);
    return reply.send(result);
  });

  app.get('/:groupId/encryption-key', { preHandler: [requireGroupAccess, encryptionKeyLimiter] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = request.params as { groupId: string };
    const result = await groupService.getGroupEncryptionKey(groupId);
    return reply.send(result);
  });

  app.put('/:groupId', {
    preHandler: [requireGroupAccess, requireGroupAdmin],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          defaultCurrency: { type: 'string', minLength: 3, maxLength: 3 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = request.params as { groupId: string };
    const { name, defaultCurrency } = request.body as { name?: string; defaultCurrency?: string };

    await groupService.updateGroup(groupId, name, defaultCurrency);

    try { emitToGroup(groupId, 'group-updated', { groupId, updatedBy: request.user.userId }); } catch {}

    return reply.send({ success: true });
  });

  app.get('/:groupId/members', { preHandler: [requireGroupAccess] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };

    const result = await groupService.getGroupMembers(groupId);
    return reply.send(result);
  });

  app.get('/:groupId/sync', { preHandler: [requireGroupAccess] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = request.params as { groupId: string };

    const result = await groupService.getGroupSync(groupId);
    return reply.send(result);
  });

  app.put('/:groupId/sync', {
    preHandler: [requireGroupAccess],
    schema: {
      body: {
        type: 'object',
        required: ['encryptedBlob', 'vectorClock'],
        properties: {
          encryptedBlob: { type: 'string', minLength: 1, maxLength: 10 * 1024 * 1024 },
          vectorClock: { type: 'object' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };
    const { encryptedBlob, vectorClock } = request.body as { encryptedBlob: string; vectorClock: Record<string, number> };

    const result = await groupService.syncGroupBlob(groupId, encryptedBlob, vectorClock, userId);

    if (result.conflict) {
      return reply.status(409).send({
        error: 'ERR_SYNC_CONFLICT',
        message: 'Data changed since last read. Please refresh and try again.',
        serverClock: result.serverClock,
        clientClock: result.clientClock,
      });
    }

    try { emitToGroup(groupId, 'group-synced', { groupId, updatedBy: userId, vectorClock: result.syncClock, updatedAt: result.updatedAt }); } catch {}

    return reply.send({
      vectorClock: result.syncClock,
      updatedAt: result.updatedAt,
    });
  });

  app.post('/:groupId/leave', {
    preHandler: [requireGroupAccess],
    schema: {
      body: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };

    const r = await groupService.leaveGroup(groupId, userId) as any;

    try { evictUserFromGroup(groupId, userId); } catch {}
    try { emitToGroup(groupId, 'member-left', { groupId, userId, leftAt: r.leftAt, adminTransferredTo: r.adminTransferredTo }); } catch {}

    return reply.send({ success: true, leftAt: r.leftAt, adminTransferredTo: r.adminTransferredTo });
  });

  app.delete('/:groupId', { preHandler: [requireGroupAccess, requireGroupAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };

    await groupService.deleteGroup(groupId, userId);

    try { emitToGroup(groupId, 'group-deleted', { groupId, deletedBy: userId }); } catch {}

    return reply.send({ success: true });
  });

  app.delete('/:groupId/members/:targetUserId', {
    preHandler: [requireGroupAccess, requireGroupAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['groupId', 'targetUserId'],
        properties: {
          groupId: { type: 'string' },
          targetUserId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId, targetUserId } = request.params as { groupId: string; targetUserId: string };

    const r = await groupService.removeMember(groupId, targetUserId, userId) as any;

    try { evictUserFromGroup(groupId, targetUserId); } catch {}
    try { emitToGroup(groupId, 'member-left', { groupId, userId: targetUserId, removedBy: userId, leftAt: r.leftAt }); } catch {}

    return reply.send({ success: true, leftAt: r.leftAt, newEncryptionKey: r.newEncryptionKey });
  });

  app.patch('/:groupId/members/:targetUserId/role', {
    preHandler: [requireGroupAccess, requireGroupAdmin],
    schema: {
      params: {
        type: 'object',
        required: ['groupId', 'targetUserId'],
        properties: {
          groupId: { type: 'string' },
          targetUserId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['admin', 'member'] },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId, targetUserId } = request.params as { groupId: string; targetUserId: string };
    const { role } = request.body as { role: 'admin' | 'member' };

    const result = await groupService.updateMemberRole(groupId, targetUserId, role, userId);

    try { emitToGroup(groupId, 'member-role-changed', { groupId, userId: targetUserId, newRole: role, updatedBy: userId }); } catch {}

    return reply.send(result);
  });
}
