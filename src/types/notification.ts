export type NotificationPriority = 'high' | 'normal' | 'low'

export interface Notification {
  id: string
  title: string
  description: string
  date: string
  time: string
  priority: NotificationPriority
}
