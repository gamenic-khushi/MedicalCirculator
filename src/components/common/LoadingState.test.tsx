import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LoadingState } from '@/components/common/LoadingState'
import { SavedSnapshotsPanel } from '@/components/model-viewer/SavedSnapshotsPanel'

describe('loading states', () => {
  it('LoadingState is a status that says the data is being loaded', () => {
    const markup = renderToStaticMarkup(<LoadingState />)
    expect(markup).toContain('role="status"')
    expect(markup).toContain('データを読み込んでいます')
  })

  it('the 保存一覧 says it is loading, not that there is no data, while its rows are on the way', () => {
    const loading = renderToStaticMarkup(<SavedSnapshotsPanel savedSnapshots={[]} isLoading onDelete={() => {}} />)
    expect(loading).toContain('データを読み込んでいます')
    expect(loading).not.toContain('利用可能なデータがありません')
    const empty = renderToStaticMarkup(<SavedSnapshotsPanel savedSnapshots={[]} onDelete={() => {}} />)
    expect(empty).toContain('利用可能なデータがありません')
    expect(empty).not.toContain('データを読み込んでいます')
  })
})
