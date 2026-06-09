import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query, transaction } from '../db/pool';

const SALT_ROUNDS = 12;

export async function personalRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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
    } catch (err: any) {
      request.log.error({ err }, 'GET /sync failed');
      return reply.status(500).send({
        error: 'ERR_SYNC_FAILED',
        message: 'Failed to retrieve sync data',
      });
    }
  });

  app.put('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;
      const { encryptedBlob, vectorClock } = request.body as {
        encryptedBlob: string;
        vectorClock: number;
      };

      if (!encryptedBlob) {
        return reply.status(400).send({
          error: 'ERR_VALIDATION',
          message: 'encryptedBlob is required',
        });
      }

      if (typeof vectorClock !== 'number' || vectorClock < 0) {
        return reply.status(400).send({
          error: 'ERR_VALIDATION',
          message: 'vectorClock must be a non-negative number',
        });
      }

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

          await client.query(
            `UPDATE personal_data
             SET encrypted_blob = $1, vector_clock = $2, updated_at = NOW()
             WHERE user_id = $3`,
            [encryptedBlob, vectorClock, userId]
          );
        } else {
          await client.query(
            `INSERT INTO personal_data (user_id, encrypted_blob, vector_clock, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())`,
            [userId, encryptedBlob, vectorClock]
          );
        }

        return { conflict: false };
      });

      if (result.conflict) {
        return reply.status(409).send({
          error: 'ERR_SYNC_CONFLICT',
          message: 'Client vector clock is behind. Fetch latest data first.',
          currentClock: result.currentClock,
          requestedClock: result.requestedClock,
        });
      }

      return reply.send({ success: true, vectorClock });
    } catch (err: any) {
      request.log.error({ err }, 'PUT /sync failed');
      return reply.status(500).send({
        error: 'ERR_SYNC_FAILED',
        message: 'Failed to store sync data',
      });
    }
  });

  app.post('/recovery-key', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;
      const { encryptedPek, recoveryKeyHash } = request.body as {
        encryptedPek: string;
        recoveryKeyHash: string;
      };

      if (!encryptedPek || !recoveryKeyHash) {
        return reply.status(400).send({
          error: 'ERR_VALIDATION',
          message: 'encryptedPek and recoveryKeyHash are required',
        });
      }

      const existing = await query(
        `SELECT encrypted_pek FROM users WHERE id = $1`,
        [userId]
      );
      if (existing.rows[0]?.encrypted_pek) {
        return reply.status(409).send({
          error: 'ERR_CONFLICT',
          message: 'Recovery key already set. Delete it first to regenerate.',
        });
      }

      await query(
        `UPDATE users
         SET encrypted_pek = $1, recovery_key_hash = $2, updated_at = NOW()
         WHERE id = $3`,
        [encryptedPek, recoveryKeyHash, userId]
      );

      return reply.send({ success: true });
    } catch (err: any) {
      request.log.error({ err }, 'POST /recovery-key failed');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to store recovery key',
      });
    }
  });

  app.get('/recovery-key', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.userId;
      const result = await query(
        `SELECT encrypted_pek FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'ERR_NOT_FOUND',
          message: 'User not found',
        });
      }

      return reply.send({
        encryptedPek: result.rows[0].encrypted_pek,
      });
    } catch (err: any) {
      request.log.error({ err }, 'GET /recovery-key failed');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to retrieve recovery key',
      });
    }
  });
}

export async function recoveryRoutes(app: FastifyInstance) {
  app.post('/recover', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'recoveryKeyHash'],
        properties: {
          email: { type: 'string', format: 'email' },
          recoveryKeyHash: { type: 'string', minLength: 32 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email, recoveryKeyHash } = request.body as {
        email: string;
        recoveryKeyHash: string;
      };

      const result = await query(
        `SELECT id, encrypted_pek, recovery_key_hash
         FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return reply.send({ success: true, encryptedPek: null });
      }

      const user = result.rows[0];

      if (!user.recovery_key_hash) {
        await query(
          `INSERT INTO user_activity_log (user_id, action, ip_address, metadata, created_at)
           VALUES ($1, 'recovery_failed', $2, $3, NOW())`,
          [user.id, request.ip, JSON.stringify({})]
        );

        return reply.send({ success: true, encryptedPek: null });
      }

      const storedHash = Buffer.from(user.recovery_key_hash);
      const providedHash = Buffer.from(recoveryKeyHash);
      const hashesMatch = storedHash.length === providedHash.length && crypto.timingSafeEqual(storedHash, providedHash);

      if (!hashesMatch) {
        await query(
          `INSERT INTO user_activity_log (user_id, action, ip_address, metadata, created_at)
           VALUES ($1, 'recovery_failed', $2, $3, NOW())`,
          [user.id, request.ip, JSON.stringify({})]
        );

        return reply.send({ success: true, encryptedPek: null });
      }

      await query(
        `INSERT INTO user_activity_log (user_id, action, ip_address, created_at)
         VALUES ($1, 'recovery_initiated', $2, NOW())`,
        [user.id, request.ip]
      );

      return reply.send({
        success: true,
        encryptedPek: user.encrypted_pek,
        userId: user.id,
      });
    } catch (err: any) {
      request.log.error({ err }, 'POST /recover failed');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Recovery process failed',
      });
    }
  });

  app.post('/recover/complete', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'newAuthKeyHash', 'newEncryptedPek', 'newPersonalSalt'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          newAuthKeyHash: { type: 'string', minLength: 32 },
          newEncryptedPek: { type: 'string', minLength: 1 },
          newPersonalSalt: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, newAuthKeyHash, newEncryptedPek, newPersonalSalt } = request.body as {
        userId: string;
        newAuthKeyHash: string;
        newEncryptedPek: string;
        newPersonalSalt: string;
      };

      const hashedAuthKey = await bcrypt.hash(newAuthKeyHash, SALT_ROUNDS);

      await transaction(async (client) => {
        await client.query(
          `UPDATE users
           SET auth_key_hash = $1,
               personal_salt = $2,
               encrypted_pek = $3,
               failed_login_attempts = 0,
               locked_until = NULL,
               updated_at = NOW()
           WHERE id = $4`,
          [hashedAuthKey, newPersonalSalt, newEncryptedPek, userId]
        );

        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1`,
          [userId]
        );

        await client.query(
          `INSERT INTO user_activity_log (user_id, action, ip_address, metadata, created_at)
           VALUES ($1, 'recovery_completed', $2, $3, NOW())`,
          [userId, request.ip, JSON.stringify({})]
        );
      });

      return reply.send({ success: true });
    } catch (err: any) {
      request.log.error({ err }, 'POST /recover/complete failed');
      return reply.status(500).send({
        error: 'ERR_INTERNAL',
        message: 'Failed to complete recovery',
      });
    }
  });
}
