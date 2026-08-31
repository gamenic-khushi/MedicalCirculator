import { Ruler } from 'lucide-react'

interface MeasurementResultsCardProps {
  upstreamSize: string
  downstreamSize: string
  pa: string
  pd: string
  stenosisRate: string
  mla: string
  lumenVolume: string
  bifurcationAngle: string
}

export function MeasurementResultsCard({
  upstreamSize,
  downstreamSize,
  pa,
  pd,
  stenosisRate,
  mla,
  lumenVolume,
  bifurcationAngle,
}: MeasurementResultsCardProps) {
  const rows = [
    { label: '上流血管径サイズ', value: upstreamSize ? `${upstreamSize} mm` : '—' },
    { label: '下流血管径サイズ', value: downstreamSize ? `${downstreamSize} mm` : '—' },
    { label: 'Pa', value: pa ? `${pa} mmHg` : '—' },
    { label: 'Pd', value: pd ? `${pd} mmHg` : '—' },
    { label: '最小断面積（MLA）', value: mla ? `${mla} mm²` : '—' },
    { label: '狭窄率', value: stenosisRate ? `${stenosisRate} %` : '—' },
    { label: '石灰化体積', value: '—' },
    { label: '内腔容積', value: lumenVolume ? `${lumenVolume} mm³` : '—' },
    { label: '分岐角度', value: bifurcationAngle ? `${bifurcationAngle} °` : '—' },
  ]

  return (
    <div className="flex-1 border-t border-gray-100 p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <Ruler className="h-4 w-4 text-blue-500" />
        計測結果
      </div>

      <dl className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
            <dt className="text-gray-500">{row.label}</dt>
            <dd className="truncate pl-2 font-medium text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
