export default function AboutSettings() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900">About</h2>
      <div className="flex flex-col gap-3 text-sm text-neutral-600">
        <p><span className="font-semibold text-neutral-800">Version:</span> 1.0.0</p>
        <p>
          ColdFi is a collaborative finance tracking application that helps you and your
          groups manage expenses, split bills, and settle up.
        </p>
        <div className="mt-2 flex gap-4">
          <button className="font-semibold text-primary-600 hover:text-primary-700">Terms of Service</button>
          <button className="font-semibold text-primary-600 hover:text-primary-700">Privacy Policy</button>
        </div>
      </div>
    </div>
  );
}
