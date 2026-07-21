import 'fastify';

interface JWTPayload {
  userId: string;
  email: string;
  role: 'user' | 'owner';
}

interface MemberInfo {
  memberId: string;
  groupId: string;
  role: 'admin' | 'member' | 'viewer';
  memberIndex: number;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JWTPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminWs?: import('socket.io').Server;
    broadcastLog?: (entry: any) => void;
    broadcastStats?: (stats: any) => void;
    broadcastAlert?: (alert: any) => void;
  }

  interface FastifyRequest {
    user: JWTPayload;
    memberInfo?: MemberInfo;
    requestId?: string;
  }
}
