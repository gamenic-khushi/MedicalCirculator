import { useEffect, useState } from 'react'

import { Toast } from '@/components/common/Toast'
import { DEFAULT_FFR_STENOSIS_FACTOR, fetchFfrStenosisFactor, saveFfrStenosisFactor } from '@/lib/formulaSettings'

const TOAST_DURATION_MS = 1800

export function FormulaSettingsPage() {
  const [value, setValue] = useState(String(DEFAULT_FFR_STENOSIS_FACTOR))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchFfrStenosisFactor()
      .then((factor) => setValue(String(factor)))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return

    setIsSaving(true)
    try {
      await saveFfrStenosisFactor(parsed)
      setToastMessage('保存しました')
      setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">計算式設定</h1>
      <div className="mt-4 border-b border-gray-200" />

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
          FFR 狭窄係数
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            disabled={isLoading}
            onChange={(event) => setValue(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 disabled:bg-gray-50"
          />
        </label>

        <div>
          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
