import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <h1 className="text-6xl font-bold text-neutral-300">404</h1>
      <p className="mt-4 text-lg text-neutral-600">Page not found</p>
      <Link
        to="/"
        className="mt-8 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        Go home
      </Link>
    </div>
  );
}
