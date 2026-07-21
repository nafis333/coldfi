import { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool';
import { ForbiddenError } from '../errors';

export async function requireGroupAccess(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.userId) {
    throw new ForbiddenError('Authentication required');
  }

  const { groupId } = request.params as { groupId: string };
  if (!groupId) {
    throw new ForbiddenError('Group ID required');
  }

  const result = await query<{ id: string; role: string; member_index: number }>(
    `SELECT gm.id, gm.role, gm.member_index
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.left_at IS NULL`,
    [groupId, request.user.userId]
  );

  if (result.rows.length === 0) {
    throw new ForbiddenError('Not a member of this group');
  }

  const row = result.rows[0]!;
  request.memberInfo = {
    memberId: row.id,
    groupId,
    role: row.role as 'admin' | 'member' | 'viewer',
    memberIndex: row.member_index,
  };
}
