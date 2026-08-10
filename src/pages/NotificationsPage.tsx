import type { Models } from 'appwrite'
import { useEffect, useState } from 'react'

import { NotificationCard } from '@/components/notifications/NotificationCard'
import { databaseService } from '@/services/appwrite/database'
import type { Notification } from '@/types/notification'

type NotificationRow = Models.Row & Omit<Notification, 'id'>

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    databaseService.list<NotificationRow>('notifications').then(({ rows }) => {
      setNotifications(rows.map(({ $id, ...rest }) => ({ id: $id, ...rest })))
    })
  }, [])

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">通知</h1>
      <p className="mt-1 text-sm text-gray-500">システム更新情報とアクティビティログ</p>

      <div className="mt-4 border-b border-gray-200" />

      <div className="mt-6 flex flex-col gap-4">
        {notifications.map((notification) => (
          <NotificationCard key={notification.id} {...notification} />
        ))}
      </div>
    </div>
  )
}
