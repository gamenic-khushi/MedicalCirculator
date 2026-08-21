import { useState, type FormEvent } from 'react'

import { Toast } from '@/components/common/Toast'
import { getFfrStenosisFactor, setFfrStenosisFactor } from '@/lib/formulaSettings'

const TOAST_DURATION_MS = 1800

export function FormulaSettingsPage() {
  const [ffrStenosisFactor, setFfrStenosisFactorInput] = useState(() =>
    String(getFfrStenosisFactor()),
  )
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(ffrStenosisFactor)
    if (!Number.isFinite(value) || value <= 0) {
      setError('0より大きい数値を入力してください')
      return
    }

    setError(null)
    setFfrStenosisFactor(value)
    setToastMessage('計算式を更新しました')
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS)
  }

  return (
    <div className="px-4 py-6 sm:px-8 lg:px-14 lg:py-8">
      <h1 className="text-2xl font-bold text-gray-900">計算式設定</h1>

      <div className="mt-4 border-b border-gray-200" />

      <form
        onSubmit={handleSubmit}
        className="mt-6 flex max-w-md flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-900">FFR 計算係数</h2>
        <p className="text-xs text-gray-500">FFR = 1 − (Stenosis rate ÷ 100) × 係数</p>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          係数
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={ffrStenosisFactor}
            onChange={(event) => setFfrStenosisFactorInput(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="mt-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          更新
        </button>
      </form>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
