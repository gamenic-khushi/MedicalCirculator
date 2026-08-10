import { Calendar, Clock } from 'lucide-react'

import type { Notification } from '@/types/notification'

import { NotificationPriorityBadge } from './NotificationPriorityBadge'

export function NotificationCard({ title, description, date, time, priority }: Notification) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <NotificationPriorityBadge priority={priority} />
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {date}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {time}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-gray-600">{description}</p>
    </article>
  )
}
