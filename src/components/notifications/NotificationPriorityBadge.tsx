import type { NotificationPriority } from '@/types/notification'

const PRIORITY_CONFIG: Record<NotificationPriority, { label: string; className: string }> = {
  high: { label: '重要', className: 'bg-red-50 text-red-600' },
  normal: { label: '普通', className: 'bg-gray-100 text-gray-600' },
  low: { label: '低い', className: 'bg-blue-50 text-blue-600' },
}

export function NotificationPriorityBadge({ priority }: { priority: NotificationPriority }) {
  const { label, className } = PRIORITY_CONFIG[priority]

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
