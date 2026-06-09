import { useOutletContext } from 'react-router-dom';

export default function ExpensesTab() {
  const { groupId } = useOutletContext<{ groupId: string }>();

  return (
    <div className="py-8 text-center text-neutral-400">
      <p className="text-lg">No expenses yet</p>
      <p className="mt-1 text-sm">Group expenses will appear here.</p>
    </div>
  );
}
