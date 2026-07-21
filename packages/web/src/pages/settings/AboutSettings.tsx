export default function AboutSettings() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">About</h2>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        ColdFi v{APP_VERSION}
      </p>
      <div className="flex flex-col gap-2">
        <a
          href="https://coldfi.app/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          Terms of Service
        </a>
        <a
          href="https://coldfi.app/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          Privacy Policy
        </a>
      </div>
    </div>
  );
}

const APP_VERSION = '1.0.0';
