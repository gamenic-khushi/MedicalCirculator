import { describe, expect, it } from 'vitest'

import { toEnglish } from './translations'

describe('toEnglish', () => {
  it('translates the names of the screens and keeps the spaces around the text', () => {
    expect(toEnglish('3D解析')).toBe('3D Analysis')
    expect(toEnglish('計測値・形状')).toBe('Measurements and Shape')
    expect(toEnglish('解析結果一覧')).toBe('Analysis Results')
    expect(toEnglish('  保存 ')).toBe('  Save ')
  })

  it('uses the wording of the Messages sheet for the messages Aki worded', () => {
    expect(toEnglish('スライダーで奥行きを調整してください')).toBe('Please adjust the depth with the slider.')
    expect(toEnglish('調整が済んだら、「④ 計測」をクリックしてください')).toBe(
      'When the adjustment is done, click "④ Measure".',
    )
  })

  it('translates the words round a value and leaves the value alone', () => {
    expect(toEnglish('学習範囲 3〜5')).toBe('Trained range 3 to 5')
    expect(toEnglish('奥 6 mm →')).toBe('Back 6 mm →')
    expect(toEnglish('FFRの計算には 8 mm を使用')).toBe('8 mm is used for the FFR calculation')
    expect(toEnglish('病変の値が推定式の学習範囲外です: 病変近位径(3〜5mm)、狭窄長(1〜8mm)。この病変ではFFRを計算できません。')).toBe(
      'The lesion values are outside the range the estimation formula was trained on: Lesion Proximal Diameter (3 to 5mm), Stenosis Length (1 to 8mm). FFR cannot be calculated for this lesion.',
    )
  })

  it('has nothing for a text it does not know (it stays Japanese)', () => {
    expect(toEnglish('テスト用の学習 A')).toBeNull()
    expect(toEnglish('')).toBeNull()
    expect(toEnglish('   ')).toBeNull()
  })
})
