import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, transaction } from '../db/pool';

export async function personalRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const result = await query(
      `SELECT encrypted_blob, vector_clock, updated_at
       FROM personal_data
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return reply.send({
        encryptedBlob: null,
        vectorClock: 0,
        updatedAt: null,
      });
    }

    const row = result.rows[0];
    return reply.send({
      encryptedBlob: row.encrypted_blob,
      vectorClock: row.vector_clock,
      updatedAt: row.updated_at,
    });
  });

  app.put('/sync', {
    schema: {
      body: {
        type: 'object',
        required: ['encryptedBlob', 'vectorClock'],
        properties: {
          encryptedBlob: { type: 'string', minLength: 1, maxLength: 10485760 },
          vectorClock: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const { encryptedBlob, vectorClock } = request.body as { encryptedBlob: string; vectorClock: number };

    const result = await transaction(async (client) => {
      const current = await client.query(
        `SELECT vector_clock FROM personal_data WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      if (current.rows.length > 0) {
        const currentClock = current.rows[0].vector_clock;
        if (vectorClock < currentClock) {
          return { conflict: true, currentClock, requestedClock: vectorClock };
        }

        const newClock = Math.max(currentClock, vectorClock) + 1;
        const updateResult = await client.query(
          `UPDATE personal_data
           SET encrypted_blob = $1, vector_clock = $2, updated_at = NOW()
           WHERE user_id = $3
           RETURNING vector_clock`,
          [encryptedBlob, newClock, userId]
        );
        return { conflict: false, newClock: updateResult.rows[0].vector_clock };
      } else {
        const newClock = vectorClock + 1;
        const insertResult = await client.query(
          `INSERT INTO personal_data (user_id, encrypted_blob, vector_clock, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (user_id) DO UPDATE
           SET encrypted_blob = EXCLUDED.encrypted_blob,
               vector_clock = GREATEST(personal_data.vector_clock, EXCLUDED.vector_clock) + 1,
               updated_at = NOW()
           RETURNING vector_clock`,
          [userId, encryptedBlob, newClock]
        );
        return { conflict: false, newClock: insertResult.rows[0].vector_clock };
      }
    });

    if (result.conflict) {
      return reply.status(409).send({
        error: 'ERR_SYNC_CONFLICT',
        message: 'Client vector clock is behind. Fetch latest data first.',
        currentClock: result.currentClock,
        requestedClock: result.requestedClock,
      });
    }

    return reply.send({ success: true, vectorClock: result.newClock });
  });
}
