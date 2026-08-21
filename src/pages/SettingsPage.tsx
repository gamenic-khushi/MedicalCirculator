import { NavLink } from 'react-router-dom'

const SETTINGS_LINKS = [
  { label: 'ユーザー管理', to: '/users' },
  { label: 'データ管理', to: '/data' },
]

export function SettingsPage() {
  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>

      <div className="mt-4 border-b border-gray-200" />

      <div className="mt-6 flex gap-2">
        {SETTINGS_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
