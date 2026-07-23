interface GroupDataWarningProps {
  groupsLength: number;
}

export default function GroupDataWarning({ groupsLength }: GroupDataWarningProps) {
  return (
    <div className="rounded-2xl bg-warning-50 dark:bg-amber-900/20 border border-warning-200 dark:border-amber-700 p-4">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
        No group data loaded. {groupsLength === 0 ? 'Join a group to see group analytics.' : 'The group encryption key may not be available.'}
      </p>
    </div>
  );
}
