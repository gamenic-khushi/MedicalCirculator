import { Box, FileText, GraduationCap, Info, type LucideIcon } from 'lucide-react'

// The global menu's items, shared by the left-hand menu (desktop) and the top
// bar's drawer (phones and narrow windows). The icon is what the left-hand menu
// shows when it is collapsed (Aki, 2026/11/25: text only when expanded, icons only
// when collapsed).
export const NAV_ITEMS: { label: string; to: string; adminOnly: boolean; icon: LucideIcon }[] = [
  { label: '3D解析', to: '/data', adminOnly: true, icon: Box },
]

// 情報 itself, the item that opens the two below it.
export const INFO_ICON: LucideIcon = Info

export const INFO_MENU_ITEMS: { label: string; to: string; icon: LucideIcon }[] = [
  { label: '学会', to: '/conference', icon: GraduationCap },
  { label: '資料', to: '/documents', icon: FileText },
]

export const SETTINGS_MENU_ITEMS = [{ label: 'ユーザー管理', to: '/users' }]
