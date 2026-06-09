import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, transaction } from '../db/pool';
import crypto from 'crypto';
import { ForbiddenError } from '../errors';
import { emitToGroup } from '../plugins/websocket';

export async function groupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

    const result = await query(
      `SELECT g.id, g.name, g.created_at,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND left_at IS NULL) as member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1 AND gm.left_at IS NULL
       ORDER BY g.created_at DESC`,
      [userId]
    );

    const groups = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      memberCount: parseInt(row.member_count, 10),
      yourBalance: 0,
    }));

    return reply.send({ groups });
  });

  app.get('/:groupId', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as any;

    const membership = await query(
      `SELECT gm.id FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.left_at IS NULL`,
      [groupId, userId]
    );

    if (membership.rows.length === 0) {
      return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'Group not found' });
    }

    const result = await query(
      `SELECT id, name, salt FROM groups WHERE id = $1`,
      [groupId]
    );

    const group = result.rows[0]!;
    return reply.send({
      id: group.id,
      name: group.name,
      salt: group.salt,
    });
  });

  app.get('/invite/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.params as { code: string };

    const result = await query(
      `SELECT id, name, salt FROM groups WHERE id = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'Group not found' });
    }

    const group = result.rows[0]!;
    return reply.send({
      id: group.id,
      name: group.name,
      salt: group.salt,
    });
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
    const { name, passphraseVerifier, salt, defaultCurrency = 'USD' } = request.body as any;

    const groupId = crypto.randomUUID();
    const memberId = crypto.randomUUID();

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO groups (id, name, passphrase_verifier, salt, default_currency, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [groupId, name.trim(), passphraseVerifier, salt, defaultCurrency, userId]
      );

      await client.query(
        `INSERT INTO group_members (id, group_id, user_id, role, member_index, joined_at)
         VALUES ($1, $2, $3, 'admin', 0, NOW())`,
        [memberId, groupId, userId]
      );
    });

    emitToGroup(groupId, 'group-created', { groupId, name: name.trim(), createdBy: userId });

    return reply.status(201).send({
      groupId,
      name: name.trim(),
      memberIndex: 0,
      role: 'admin',
    });
  });

  app.post('/join', {
    schema: {
      body: {
        type: 'object',
        required: ['groupId', 'passphraseVerifier'],
        properties: {
          groupId: { type: 'string', format: 'uuid' },
          passphraseVerifier: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId, passphraseVerifier } = request.body as any;

    const groupResult = await query(
      `SELECT id, passphrase_verifier FROM groups WHERE id = $1`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'Group not found' });
    }

    const group = groupResult.rows[0]!;
    const a = Buffer.from(group.passphrase_verifier);
    const b = Buffer.from(passphraseVerifier);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return reply.status(403).send({ error: 'ERR_WRONG_PASSPHRASE', message: 'Invalid passphrase' });
    }

    const existingMember = await query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    if (existingMember.rows.length > 0) {
      return reply.status(409).send({ error: 'ERR_CONFLICT', message: 'Already a member of this group' });
    }

    const memberId = crypto.randomUUID();
    const nextIndex = await transaction(async (client) => {
      const maxResult = await client.query(
        `SELECT COALESCE(MAX(member_index), -1) as max_index FROM group_members WHERE group_id = $1 FOR UPDATE`,
        [groupId]
      );
      const idx = (maxResult.rows[0] as any).max_index + 1;
      await client.query(
        `INSERT INTO group_members (id, group_id, user_id, role, member_index, joined_at)
         VALUES ($1, $2, $3, 'member', $4, NOW())`,
        [memberId, groupId, userId, idx]
      );
      return idx;
    });

    emitToGroup(groupId, 'member-joined', { groupId, userId, memberIndex: nextIndex, role: 'member' });

    return reply.status(200).send({
      groupId,
      memberIndex: nextIndex,
      role: 'member',
    });
  });

  app.get('/:groupId/members', { preHandler: [requireGroupMember] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };

    const groupResult = await query(
      `SELECT name FROM groups WHERE id = $1`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return reply.status(404).send({ error: 'ERR_GROUP_NOT_FOUND', message: 'Group not found' });
    }

    const membersResult = await query(
      `SELECT gm.user_id, u.display_name, u.email, gm.role, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.left_at IS NULL
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );

    const members = membersResult.rows.map((row: any) => ({
      userId: row.user_id,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
      balance: 0,
      joinedAt: row.joined_at,
    }));

    return reply.send({
      id: groupId,
      name: groupResult.rows[0]!.name,
      members,
      myBalance: 0,
    });
  });

  // Group access middleware for sync routes
  async function requireGroupMember(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };

    const result = await query(
      `SELECT gm.id FROM groups g
       JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1 AND gm.left_at IS NULL
       WHERE g.id = $2`,
      [userId, groupId]
    );

    if (result.rows.length === 0) {
      throw new ForbiddenError('Not a member of this group');
    }
  }

  app.get('/:groupId/sync', { preHandler: [requireGroupMember] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = request.params as { groupId: string };

    const result = await query(
      `SELECT encrypted_blob, vector_clock, updated_at FROM group_sync WHERE group_id = $1`,
      [groupId]
    );

    if (result.rows.length === 0) {
      return reply.status(200).send({
        encryptedBlob: null,
        vectorClock: {},
        updatedAt: null,
      });
    }

    const row = result.rows[0]!;
    return reply.status(200).send({
      encryptedBlob: row.encrypted_blob,
      vectorClock: row.vector_clock,
      updatedAt: row.updated_at,
    });
  });

  app.put('/:groupId/sync', { preHandler: [requireGroupMember] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };
    const { encryptedBlob, vectorClock } = request.body as { encryptedBlob: string; vectorClock: Record<string, number> };

    if (!encryptedBlob) {
      return reply.status(400).send({ error: 'ERR_VALIDATION', message: 'Encrypted blob is required' });
    }

    if (!vectorClock || typeof vectorClock !== 'object') {
      return reply.status(400).send({ error: 'ERR_VALIDATION', message: 'Vector clock is required' });
    }

    const result = await transaction(async (client) => {
      const existing = await client.query(
        `SELECT encrypted_blob, vector_clock FROM group_sync WHERE group_id = $1 FOR UPDATE`,
        [groupId]
      );

      if (existing.rows.length > 0) {
        const serverClock = existing.rows[0]!.vector_clock || {};
        const conflict = detectConflict(serverClock, vectorClock);

        if (conflict) {
          return reply.status(409).send({
            error: 'ERR_SYNC_CONFLICT',
            message: 'Data changed since last read. Please refresh and try again.',
            serverClock,
            clientClock: vectorClock,
          });
        }
      }

      const mergedClock = mergeClocks(
        (existing.rows[0] as any)?.vector_clock || {},
        vectorClock
      );
      mergedClock[userId] = (mergedClock[userId] || 0) + 1;

      await client.query(
        `INSERT INTO group_sync (group_id, encrypted_blob, vector_clock, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (group_id) DO UPDATE SET
           encrypted_blob = $2,
           vector_clock = $3,
           updated_by = $4,
           updated_at = NOW()`,
        [groupId, encryptedBlob, JSON.stringify(mergedClock), userId]
      );

      emitToGroup(groupId, 'group-synced', { groupId, updatedBy: userId, vectorClock: mergedClock, updatedAt: new Date().toISOString() });

      return reply.status(200).send({
        vectorClock: mergedClock,
        updatedAt: new Date().toISOString(),
      });
    });

    return result;
  });

  app.post('/:groupId/leave', { preHandler: [requireGroupMember] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { groupId } = request.params as { groupId: string };

    const memberResult = await query(
      `SELECT id, left_at FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );

    if (memberResult.rows.length === 0) {
      return reply.status(404).send({ error: 'ERR_NOT_FOUND', message: 'Not a member of this group' });
    }

    const member = memberResult.rows[0]!;
    if (member.left_at) {
      return reply.status(400).send({ error: 'ERR_CONFLICT', message: 'Already left this group' });
    }

    await query(
      `UPDATE group_members SET left_at = NOW() WHERE id = $1`,
      [member.id]
    );

    emitToGroup(groupId, 'member-left', { groupId, userId, leftAt: new Date().toISOString() });

    return reply.status(200).send({
      success: true,
      leftAt: new Date().toISOString(),
    });
  });
}

function detectConflict(
  serverClock: Record<string, number>,
  clientClock: Record<string, number>
): boolean {
  const allKeys = new Set([
    ...Object.keys(serverClock),
    ...Object.keys(clientClock),
  ]);

  let serverGreater = false;
  let clientGreater = false;

  for (const key of allKeys) {
    const sv = serverClock[key] || 0;
    const cv = clientClock[key] || 0;

    if (sv > cv) serverGreater = true;
    if (cv > sv) clientGreater = true;
  }

  return serverGreater && clientGreater;
}

function mergeClocks(
  serverClock: Record<string, number>,
  clientClock: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = {};
  const allKeys = new Set([
    ...Object.keys(serverClock),
    ...Object.keys(clientClock),
  ]);

  for (const key of allKeys) {
    merged[key] = Math.max(serverClock[key] || 0, clientClock[key] || 0);
  }

  return merged;
}
