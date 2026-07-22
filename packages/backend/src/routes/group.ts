import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as groupService from '../services/groupService';
import { emitToGroup } from '../plugins/websocket';
import { requireGroupAccess, requireGroupAdmin } from '../middleware';

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
        required: ['name', 'passphraseVerifier', 'salt'],
        properties: {
          name: { type: 'string', minLength: 1 },
          passphraseVerifier: { type: 'string', minLength: 1 },
          salt: { type: 'string', minLength: 1 },
          defaultCurrency: { type: 'string', minLength: 3, maxLength: 3 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { name, passphraseVerifier, salt, defaultCurrency = 'BDT' } = request.body as any;

    const result = await groupService.createGroup(name, passphraseVerifier, salt, defaultCurrency, userId);

    try { emitToGroup(result.groupId, 'group-created', { groupId: result.groupId, name: result.name, createdBy: userId }); } catch {}

    return reply.status(201).send(result);
  });

  app.post('/:groupId/invites', { preHandler: [requireGroupAccess, requireGroupAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
        required: ['inviteCode', 'passphraseVerifier'],
        properties: {
          inviteCode: { type: 'string', minLength: 1 },
          passphraseVerifier: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { inviteCode, passphraseVerifier } = request.body as any;

    const result = await groupService.joinGroup(inviteCode, passphraseVerifier, userId);

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

  app.put('/:groupId/passphrase', { preHandler: [requireGroupAccess, requireGroupAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = request.params as { groupId: string };
    const { newPassphraseVerifier, newSalt } = request.body as { newPassphraseVerifier: string; newSalt: string };

    await groupService.changeGroupPassphrase(groupId, newPassphraseVerifier, newSalt);

    try { emitToGroup(groupId, 'passphrase-changed', { groupId, updatedBy: request.user.userId }); } catch {}

    return reply.send({ success: true });
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

  app.put('/:groupId/sync', { preHandler: [requireGroupAccess] }, async (request: FastifyRequest, reply: FastifyReply) => {
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

  app.post('/:groupId/leave', { preHandler: [requireGroupAccess] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };
    const { force } = request.body as { force?: boolean } || {};

    const result = await groupService.leaveGroup(groupId, userId, force);

    try { emitToGroup(groupId, 'member-left', { groupId, userId, leftAt: result.leftAt, adminTransferredTo: result.adminTransferredTo }); } catch {}

    return reply.send({ success: true, leftAt: result.leftAt, adminTransferredTo: result.adminTransferredTo });
  });

  app.delete('/:groupId/members/:targetUserId', { preHandler: [requireGroupAccess] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId, targetUserId } = request.params as { groupId: string; targetUserId: string };

    const result = await groupService.removeMember(groupId, targetUserId, userId);

    try { emitToGroup(groupId, 'member-left', { groupId, userId: targetUserId, removedBy: userId, leftAt: result.leftAt }); } catch {}

    return reply.send({ success: true, leftAt: result.leftAt });
  });

  app.patch('/:groupId/members/:targetUserId/role', { preHandler: [requireGroupAccess] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId, targetUserId } = request.params as { groupId: string; targetUserId: string };
    const { role } = request.body as { role: 'admin' | 'member' };

    if (!role || !['admin', 'member'].includes(role)) {
      return reply.status(400).send({ error: 'ERR_VALIDATION', message: 'Role must be admin or member' });
    }

    const result = await groupService.updateMemberRole(groupId, targetUserId, role, userId);

    try { emitToGroup(groupId, 'member-role-changed', { groupId, userId: targetUserId, newRole: role, updatedBy: userId }); } catch {}

    return reply.send(result);
  });
}
