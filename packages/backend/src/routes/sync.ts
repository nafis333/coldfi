import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool';
import { ValidationError } from '../errors';

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/sync/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const since = (request.query as any).since as string | undefined;

    if (since && isNaN(Date.parse(since))) {
      throw new ValidationError('Invalid since parameter: must be a valid ISO timestamp');
    }

    const personalResult = await query(
      `SELECT encrypted_blob, vector_clock, updated_at
       FROM personal_data
       WHERE user_id = $1`,
      [userId]
    );

    let personal = null;
    if (personalResult.rows.length > 0) {
      const row = personalResult.rows[0];
      personal = {
        encryptedBlob: row.encrypted_blob,
        vectorClock: row.vector_clock,
        updatedAt: row.updated_at,
      };
    }

    let groupQuery = `
      SELECT gm.group_id, g.name, gs.encrypted_blob, gs.vector_clock, gs.updated_at
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      LEFT JOIN group_sync gs ON gs.group_id = gm.group_id
      WHERE gm.user_id = $1 AND gm.left_at IS NULL
    `;
    const groupParams: any[] = [];

    if (since) {
      groupQuery += ` AND (gs.updated_at IS NULL OR gs.updated_at > $2)`;
      groupParams.push(since);
    }

    groupQuery += ` ORDER BY g.name ASC`;
    groupParams.unshift(userId);

    const groupResult = await query(groupQuery, groupParams);

    const groups = groupResult.rows.map((row: any) => ({
      groupId: row.group_id,
      name: row.name,
      encryptedBlob: row.encrypted_blob,
      vectorClock: row.vector_clock,
      updatedAt: row.updated_at,
    }));

    return reply.send({ personal, groups });
  });
}
