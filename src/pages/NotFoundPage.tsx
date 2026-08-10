import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Page not found</h1>
      <Link to="/" className="text-blue-600 hover:underline dark:text-blue-400">
        Back to home
      </Link>
    </div>
  )
}
