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

  const result = await query<{ id: string; role: string; member_index: number; group_active: boolean }>(
    `SELECT gm.id, gm.role, gm.member_index, g.is_active AS group_active
     FROM group_members gm
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.left_at IS NULL`,
    [groupId, request.user.userId]
  );

  if (result.rows.length === 0) {
    throw new ForbiddenError('Not a member of this group');
  }

  const membership = result.rows[0]!;
  if (membership.group_active === false) {
    throw new ForbiddenError('This group has been deleted');
  }

  request.memberInfo = {
    memberId: membership.id,
    groupId,
    role: membership.role as 'admin' | 'member' | 'viewer',
    memberIndex: membership.member_index,
  };
}
