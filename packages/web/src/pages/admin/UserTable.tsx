import StatusBadge from './StatusBadge';

interface UserItem {
  id: string;
  displayName?: string;
  emailHash: string;
  status: string;
  createdAt: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
}

interface UserTableProps {
  items: UserItem[];
  pagination?: PaginationInfo;
  selectedUserId: string | null;
  page: number;
  onSelectUser: (id: string) => void;
  onPageChange: (page: number) => void;
}

export default function UserTable({ items, pagination, selectedUserId, page, onSelectUser, onPageChange }: UserTableProps) {
  return (
    <>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">Name</th>
              <th className="p-3">Email (hash)</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((u: UserItem) => (
              <tr key={u.id} onClick={() => onSelectUser(u.id)}
                className={`border-b border-neutral-100 cursor-pointer hover:bg-neutral-50 ${selectedUserId === u.id ? 'bg-primary-50' : ''}`}>
                <td className="p-3 font-medium text-neutral-900">{u.displayName || 'N/A'}</td>
                <td className="p-3 font-mono text-xs text-neutral-500">{u.emailHash}...</td>
                <td className="p-3"><StatusBadge status={u.status} /></td>
                <td className="p-3 text-neutral-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-neutral-500">Total: {pagination.total}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50">Prev</button>
            <button disabled={page * 50 >= pagination.total} onClick={() => onPageChange(page + 1)}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </>
  );
}
