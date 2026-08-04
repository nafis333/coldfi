import crypto from 'crypto';
import { query, transaction } from '../db/pool';
import { AppError } from '../errors';

function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

const BLOB_IV_LENGTH = 12;
const BLOB_TAG_LENGTH = 16;

// Group blobs are encrypted client-side as base64(iv + ciphertext + tag) using AES-256-GCM,
// matching packages/web/src/lib/crypto.ts (encryptData/decryptData).
function decryptGroupBlob(keyHex: string, blobBase64: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const combined = Buffer.from(blobBase64, 'base64');
  if (combined.length < BLOB_IV_LENGTH + BLOB_TAG_LENGTH) {
    throw new AppError('ERR_ENCRYPTION', 'Invalid encrypted blob', 500);
  }
  const iv = combined.subarray(0, BLOB_IV_LENGTH);
  const tag = combined.subarray(combined.length - BLOB_TAG_LENGTH);
  const ciphertext = combined.subarray(BLOB_IV_LENGTH, combined.length - BLOB_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

function encryptGroupBlob(keyHex: string, plaintext: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(BLOB_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

// Rotates the group encryption key and re-encrypts the stored blob with the new key
// so that clients holding the old key can no longer decrypt group data.
async function rotateGroupEncryptionKey(
  client: any,
  groupId: string
): Promise<{ newKey: string }> {
  const keyRes = await client.query(
    `SELECT encryption_key FROM groups WHERE id = $1 FOR UPDATE`,
    [groupId]
  );
  const oldKey = keyRes.rows[0]?.encryption_key;
  if (!oldKey) throw new AppError('ERR_NOT_FOUND', 'Group not found', 404);

  const newKey = generateEncryptionKey();
  await client.query(
    `UPDATE groups SET encryption_key = $1, updated_at = NOW() WHERE id = $2`,
    [newKey, groupId]
  );

  const blobRes = await client.query(
    `SELECT encrypted_blob FROM group_sync WHERE group_id = $1`,
    [groupId]
  );
  const blob = blobRes.rows[0]?.encrypted_blob;
  if (blob) {
    const plaintext = decryptGroupBlob(oldKey, blob);
    await client.query(
      `UPDATE group_sync SET encrypted_blob = $1 WHERE group_id = $2`,
      [encryptGroupBlob(newKey, plaintext), groupId]
    );
  }

  return { newKey };
}

export async function listUserGroups(userId: string): Promise<any[]> {
  const result = await query(
    `SELECT g.id, g.name, g.default_currency, g.created_at,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND left_at IS NULL) as member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1 AND gm.left_at IS NULL
     ORDER BY g.created_at DESC`,
    [userId]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    memberCount: parseInt(row.member_count, 10),
    defaultCurrency: row.default_currency,
    yourBalance: 0, // Computed client-side from encrypted sync blob
  }));
}

export async function getGroupDetail(groupId: string, userId: string): Promise<any> {
  const membership = await query(
    `SELECT gm.id FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.left_at IS NULL`,
    [groupId, userId]
  );

  if (membership.rows.length === 0) {
    throw new AppError('ERR_NOT_FOUND', 'Group not found', 404);
  }

  const result = await query(
    `SELECT id, name FROM groups WHERE id = $1`,
    [groupId]
  );

  const group = result.rows[0];
  return { id: group.id, name: group.name };
}

export async function lookupInvite(code: string): Promise<any> {
    const result = await query(
      `SELECT g.id, g.name
       FROM invite_codes ic
       JOIN groups g ON g.id = ic.group_id AND g.is_active = TRUE
       WHERE ic.code = $1 AND ic.is_active = TRUE
         AND (ic.expires_at IS NULL OR ic.expires_at > NOW())
         AND (ic.max_uses = 0 OR ic.use_count < ic.max_uses)`,
      [code]
    );

    if (result.rows.length === 0) {
      throw new AppError('ERR_INVITE_INVALID', 'Invite code not found or expired', 404);
    }

    const group = result.rows[0];
    return { id: group.id, name: group.name };
}

export async function createGroup(
  name: string,
  defaultCurrency: string,
  userId: string
): Promise<{ groupId: string; name: string; memberIndex: number; role: string }> {
  const groupId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const encryptionKey = generateEncryptionKey();

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO groups (id, name, encryption_key, passphrase_verifier, group_salt, group_data_enc, default_currency, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [groupId, name.trim(), encryptionKey, '', '', Buffer.from(''), defaultCurrency, userId]
    );

    await client.query(
      `INSERT INTO group_members (id, group_id, user_id, role, member_index, joined_at)
       VALUES ($1, $2, $3, 'admin', 0, NOW())`,
      [memberId, groupId, userId]
    );
  });

  return { groupId, name: name.trim(), memberIndex: 0, role: 'admin' };
}

export async function createInvite(
  groupId: string,
  userId: string
): Promise<{ inviteId: string; code: string; expiresIn: string; maxUses: number }> {
  const code = crypto.randomBytes(6).toString('base64url');
  const inviteId = crypto.randomUUID();

  await query(
    `INSERT INTO invite_codes (id, group_id, code, created_by, expires_at, max_uses)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', 0)`,
    [inviteId, groupId, code, userId]
  );

  return { inviteId, code, expiresIn: '7d', maxUses: 0 };
}

export async function getInvites(groupId: string): Promise<any[]> {
  const result = await query(
    `SELECT id, code, use_count, max_uses, expires_at, is_active, created_at
     FROM invite_codes
     WHERE group_id = $1
     ORDER BY created_at DESC`,
    [groupId]
  );

  return result.rows;
}

export async function revokeInvite(inviteId: string, groupId: string): Promise<void> {
  await query(
    `UPDATE invite_codes SET is_active = FALSE WHERE id = $1 AND group_id = $2`,
    [inviteId, groupId]
  );
}

export async function joinGroup(
  inviteCode: string,
  userId: string
): Promise<{ groupId: string; memberIndex: number }> {
  const memberId = crypto.randomUUID();

  return transaction(async (client) => {
    const inviteResult = await client.query(
      `SELECT ic.group_id
       FROM invite_codes ic
       JOIN groups g ON g.id = ic.group_id AND g.is_active = TRUE
       WHERE ic.code = $1 AND ic.is_active = TRUE
         AND (ic.expires_at IS NULL OR ic.expires_at > NOW())
         AND (ic.max_uses = 0 OR ic.use_count < ic.max_uses)
       FOR UPDATE OF ic`,
      [inviteCode]
    );

    if (inviteResult.rows.length === 0) {
      throw new AppError('ERR_INVITE_INVALID', 'Invite code not found or expired', 404);
    }

    const groupId = inviteResult.rows[0].group_id;

    const existing = await client.query(
      `SELECT id, left_at, member_index FROM group_members WHERE group_id = $1 AND user_id = $2 FOR UPDATE`,
      [groupId, userId]
    );

    await client.query(
      `UPDATE invite_codes SET use_count = use_count + 1 WHERE code = $1`,
      [inviteCode]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (!row.left_at) {
        throw new AppError('ERR_CONFLICT', 'Already a member of this group', 409);
      }
      await client.query(
        `UPDATE group_members SET left_at = NULL, role = 'member', joined_at = NOW() WHERE id = $1`,
        [row.id]
      );
      return { groupId, memberIndex: row.member_index };
    }

    await client.query(`SELECT id FROM groups WHERE id = $1 FOR UPDATE`, [groupId]);
    const maxResult = await client.query(
      `SELECT COALESCE(MAX(member_index), -1) as max_index FROM group_members WHERE group_id = $1`,
      [groupId]
    );
    const idx = (maxResult.rows[0] as any).max_index + 1;
    await client.query(
      `INSERT INTO group_members (id, group_id, user_id, role, member_index, joined_at)
       VALUES ($1, $2, $3, 'member', $4, NOW())`,
      [memberId, groupId, userId, idx]
    );

    return { groupId, memberIndex: idx };
  });
}

export async function getBalanceSummary(groupId: string, userId: string): Promise<any> {
  const result = await query(
    `SELECT
      (SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND left_at IS NULL)::int AS member_count,
      (SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2) AS your_role,
      (SELECT MAX(updated_at) FROM group_sync WHERE group_id = $1) AS last_activity`,
    [groupId, userId]
  );

  const row = result.rows[0];
  return {
    memberCount: row.member_count,
    yourRole: row.your_role,
    lastActivity: row.last_activity,
  };
}

export async function getGroupEncryptionKey(groupId: string): Promise<{ encryptionKey: string }> {
  const result = await query(`SELECT encryption_key FROM groups WHERE id = $1`, [groupId]);
  if (result.rows.length === 0) throw new AppError('ERR_NOT_FOUND', 'Group not found', 404);
  return { encryptionKey: result.rows[0].encryption_key };
}

export async function updateGroup(
  groupId: string,
  name?: string,
  defaultCurrency?: string
): Promise<any> {
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (name) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
  if (defaultCurrency) { updates.push(`default_currency = $${idx++}`); values.push(defaultCurrency.toUpperCase()); }

  if (updates.length === 0) {
    throw new AppError('ERR_VALIDATION', 'No fields to update', 400);
  }

  updates.push(`updated_at = NOW()`);
  values.push(groupId);

  await query(
    `UPDATE groups SET ${updates.join(', ')} WHERE id = $${idx}`,
    values
  );

  return { success: true };
}

export async function getGroupMembers(groupId: string): Promise<any> {
  const groupResult = await query(`SELECT name, default_currency FROM groups WHERE id = $1`, [groupId]);

  if (groupResult.rows.length === 0) {
    throw new AppError('ERR_GROUP_NOT_FOUND', 'Group not found', 404);
  }

  const membersResult = await query(
    `SELECT gm.user_id, u.display_name, u.email, gm.role, gm.joined_at, gm.left_at
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.left_at NULLS FIRST, gm.joined_at ASC`,
    [groupId]
  );

  const members = membersResult.rows.map((row: any) => ({
    userId: row.user_id,
    displayName: row.display_name,
    email: row.left_at ? null : row.email,
    role: row.role,
    balance: 0,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
  }));

  return {
    id: groupId,
    name: groupResult.rows[0].name,
    defaultCurrency: groupResult.rows[0].default_currency,
    members,
    myBalance: 0,
  };
}

export async function getGroupSync(groupId: string): Promise<{
  encryptedBlob: any;
  vectorClock: Record<string, number>;
  updatedAt: any;
}> {
  const result = await query(
    `SELECT encrypted_blob, vector_clock, updated_at FROM group_sync WHERE group_id = $1`,
    [groupId]
  );

  if (result.rows.length === 0) {
    return { encryptedBlob: null, vectorClock: {}, updatedAt: null };
  }

  const row = result.rows[0];
  return {
    encryptedBlob: row.encrypted_blob,
    vectorClock: row.vector_clock,
    updatedAt: row.updated_at,
  };
}

export async function syncGroupBlob(
  groupId: string,
  encryptedBlob: string,
  vectorClock: Record<string, number>,
  userId: string
): Promise<{
  conflict: boolean;
  serverClock?: Record<string, number>;
  clientClock?: Record<string, number>;
  syncClock?: Record<string, number>;
  updatedAt?: string;
}> {
  if (!encryptedBlob) {
    throw new AppError('ERR_VALIDATION', 'Encrypted blob is required', 400);
  }

  if (!vectorClock || typeof vectorClock !== 'object') {
    throw new AppError('ERR_VALIDATION', 'Vector clock is required', 400);
  }

  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT encrypted_blob, vector_clock FROM group_sync WHERE group_id = $1 FOR UPDATE`,
      [groupId]
    );

    if (existing.rows.length > 0) {
      const serverClock = existing.rows[0].vector_clock || {};
      const conflict = detectConflict(serverClock, vectorClock);

      if (conflict) {
        return { conflict: true, serverClock, clientClock: vectorClock };
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

    return {
      conflict: false,
      syncClock: mergedClock,
      updatedAt: new Date().toISOString(),
    };
  });
}

async function deactivateAndCreateInvite(client: any, groupId: string, userId: string): Promise<void> {
  // Deactivate all existing invites
  await client.query(
    `UPDATE invite_codes SET is_active = FALSE WHERE group_id = $1`,
    [groupId]
  );
  // Create a new invite
  const code = crypto.randomBytes(6).toString('base64url');
  const inviteId = crypto.randomUUID();
  await client.query(
    `INSERT INTO invite_codes (id, group_id, code, created_by, expires_at, max_uses)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', 0)`,
    [inviteId, groupId, code, userId]
  );
}

export async function removeMember(
  groupId: string,
  targetUserId: string,
  adminUserId: string
): Promise<{ leftAt: string; newEncryptionKey: string }> {
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT id, role, left_at FROM group_members WHERE group_id = $1 AND user_id = $2 FOR UPDATE`,
      [groupId, targetUserId]
    );
    if (result.rows.length === 0) throw new AppError('ERR_NOT_FOUND', 'Member not found', 404);
    if (result.rows[0].left_at) throw new AppError('ERR_CONFLICT', 'Already left', 400);

    const adminRes = await client.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL FOR UPDATE`,
      [groupId, adminUserId]
    );
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      throw new AppError('ERR_FORBIDDEN', 'Admin access required', 403);
    }
    if (targetUserId === adminUserId) throw new AppError('ERR_VALIDATION', 'Use leave endpoint to leave', 400);

    if (result.rows[0].role === 'admin') {
      const remainingAdmins = await client.query(
        `SELECT user_id FROM group_members WHERE group_id = $1 AND left_at IS NULL AND role = 'admin' AND user_id != $2
         ORDER BY joined_at ASC LIMIT 1`,
        [groupId, targetUserId]
      );
      if (remainingAdmins.rows.length === 0) {
        const nextMember = await client.query(
          `SELECT user_id FROM group_members WHERE group_id = $1 AND left_at IS NULL AND user_id != $2 ORDER BY joined_at ASC LIMIT 1`,
          [groupId, targetUserId]
        );
        if (nextMember.rows.length > 0) {
          await client.query(
            `UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`,
            [groupId, nextMember.rows[0].user_id]
          );
        }
      }
    }

    await client.query(
      `UPDATE group_members SET left_at = NOW() WHERE id = $1`,
      [result.rows[0].id]
    );

    // Rotate encryption key + regenerate invites.
    // The blob is re-encrypted server-side with the new key; the admin receives
    // the new key so their client can refresh its local key cache immediately.
    const { newKey } = await rotateGroupEncryptionKey(client, groupId);
    await deactivateAndCreateInvite(client, groupId, adminUserId);

    return { leftAt: new Date().toISOString(), newEncryptionKey: newKey };
  });
}

export async function updateMemberRole(
  groupId: string,
  targetUserId: string,
  newRole: 'admin' | 'member',
  adminUserId: string
): Promise<{ role: string }> {
  return transaction(async (client) => {
    const adminRes = await client.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL FOR UPDATE`,
      [groupId, adminUserId]
    );
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      throw new AppError('ERR_FORBIDDEN', 'Admin access required', 403);
    }

    const targetRes = await client.query(
      `SELECT id, role, left_at FROM group_members WHERE group_id = $1 AND user_id = $2 FOR UPDATE`,
      [groupId, targetUserId]
    );
    if (targetRes.rows.length === 0) throw new AppError('ERR_NOT_FOUND', 'Member not found', 404);
    if (targetRes.rows[0].left_at) throw new AppError('ERR_CONFLICT', 'Cannot change role of former member', 400);
    if (targetUserId === adminUserId) throw new AppError('ERR_VALIDATION', 'Cannot change your own role', 400);

    await client.query(
      `UPDATE group_members SET role = $1 WHERE id = $2`,
      [newRole, targetRes.rows[0].id]
    );

    return { role: newRole };
  });
}

export async function deleteGroup(groupId: string, userId: string): Promise<{ success: boolean }> {
  return transaction(async (client) => {
    const adminRes = await client.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL FOR UPDATE`,
      [groupId, userId]
    );
    if (adminRes.rows.length === 0 || adminRes.rows[0].role !== 'admin') {
      throw new AppError('ERR_FORBIDDEN', 'Admin access required', 403);
    }
    await client.query(`UPDATE groups SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [groupId]);
    await client.query(`UPDATE invite_codes SET is_active = FALSE WHERE group_id = $1`, [groupId]);
    return { success: true };
  });
}

export async function leaveGroup(
  groupId: string,
  userId: string
): Promise<{ leftAt: string; adminTransferredTo?: string }> {
  return transaction(async (client) => {
    const memberResult = await client.query(
      `SELECT id, role, left_at FROM group_members WHERE group_id = $1 AND user_id = $2 FOR UPDATE`,
      [groupId, userId]
    );

    if (memberResult.rows.length === 0) {
      throw new AppError('ERR_NOT_FOUND', 'Not a member of this group', 404);
    }

    const member = memberResult.rows[0];
    if (member.left_at) {
      throw new AppError('ERR_CONFLICT', 'Already left this group', 400);
    }

    await client.query(
      `UPDATE group_members SET left_at = NOW() WHERE id = $1`,
      [member.id]
    );

    let adminTransferredTo: string | undefined;
    if (member.role === 'admin') {
      const remainingAdmins = await client.query(
        `SELECT user_id FROM group_members WHERE group_id = $1 AND left_at IS NULL AND role = 'admin' AND user_id != $2
         ORDER BY joined_at ASC LIMIT 1`,
        [groupId, userId]
      );
      if (remainingAdmins.rows.length === 0) {
        const nextMember = await client.query(
          `SELECT user_id FROM group_members WHERE group_id = $1 AND left_at IS NULL ORDER BY joined_at ASC LIMIT 1`,
          [groupId]
        );
        if (nextMember.rows.length > 0) {
          adminTransferredTo = nextMember.rows[0].user_id;
          await client.query(
            `UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`,
            [groupId, adminTransferredTo]
          );
        }
      }
    }

    // Rotate encryption key + regenerate invites.
    // The new key is never handed to the departing member; the server re-encrypts
    // the stored blob so remaining members simply fetch the new key as usual.
    await rotateGroupEncryptionKey(client, groupId);
    await deactivateAndCreateInvite(client, groupId, userId);

    return { leftAt: new Date().toISOString(), adminTransferredTo };
  });
}

function detectConflict(
  serverClock: Record<string, number>,
  clientClock: Record<string, number>
): boolean {
  const allKeys = new Set([...Object.keys(serverClock), ...Object.keys(clientClock)]);
  let serverHasNewer = false;
  let clientHasNewer = false;

  for (const key of allKeys) {
    const sv = serverClock[key] || 0;
    const cv = clientClock[key] || 0;
    // A client that is missing a key the server has (cv === 0) is stale —
    // it must fetch and merge before uploading, otherwise a fresh device
    // would silently overwrite the group blob with empty data.
    if (sv > cv) serverHasNewer = true;
    // Only treat extra client progress as newer when the server already
    // knew about this key (true concurrent divergence, not a fresh upload).
    if (cv > sv && sv > 0) clientHasNewer = true;
  }

  // Any case where the server has data the client is missing means the
  // client is operating on a stale blob — reject it (409) so the client
  // refetches and re-applies its mutation on top of fresh data instead of
  // silently overwriting another member's changes.
  return serverHasNewer;
}

function mergeClocks(
  serverClock: Record<string, number>,
  clientClock: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(serverClock), ...Object.keys(clientClock)]);

  for (const key of allKeys) {
    merged[key] = Math.max(serverClock[key] || 0, clientClock[key] || 0);
  }

  return merged;
}
