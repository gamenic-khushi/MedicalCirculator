import { LOADING_DATA } from '@/lib/messages'

// Shown in place of a list while its data is on the way, so an empty list is never
// mistaken for "nothing here". (LoadingOverlay is the full-screen one, for work
// the user waits on; this one sits in the page.)
export function LoadingState({ message = LOADING_DATA }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white p-10 text-sm text-gray-500 shadow-sm"
    >
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600"
      />
      {message}
    </div>
  )
}
