import { expect, test, type Page } from '@playwright/test'

import { useFakeAppwrite } from './support/fakeAppwrite'
import { makeStenosisStl } from './support/stenosisModel'

// The value box of a row in the 選択病変 panel, found by the row's label.
function field(page: Page, label: string) {
  return page.locator(
    `xpath=//span[normalize-space(.)="${label}"]/ancestor::div[@data-lesion-field][1]//input`,
  )
}

async function uploadModel(page: Page, studyName: string, unit = 1) {
  await page.goto('/data/3d-analysis')
  await page.getByLabel('学習名').fill(studyName)
  await page.locator('input[type=file]').setInputFiles({
    name: 'vessel.stl',
    mimeType: 'application/octet-stream',
    buffer: makeStenosisStl(unit),
  })
  await page.waitForURL('**/data/lesion-measurement/analysis')
  await expect(page.getByText('3D狭窄形状プレビュー')).toBeVisible()
}

test.describe('folder list (3D解析)', () => {
  test('an admin sees the folders the fake server holds', async ({ page }) => {
    await useFakeAppwrite(page)
    await page.goto('/data')
    await expect(page.getByRole('heading', { name: '3D解析' })).toBeVisible()
    await expect(page.getByText('テスト用の学習 A')).toBeVisible()
    await expect(page.getByText('テスト用の学習 B')).toBeVisible()
  })

  test('a signed-out visitor is sent to the login page', async ({ page }) => {
    await useFakeAppwrite(page, { signedIn: false })
    await page.goto('/data')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('upload page', () => {
  test('a 学習名 is required before a file is taken', async ({ page }) => {
    await useFakeAppwrite(page)
    await page.goto('/data/3d-analysis')
    await page.getByRole('button', { name: 'フォルダを開く' }).click()
    await expect(page.getByText('学習名を入力してください')).toBeVisible()
    await expect(page).toHaveURL(/\/data\/3d-analysis$/)
  })

  test('with a name, the file is saved as a folder and the lesion page opens', async ({ page }) => {
    const fake = await useFakeAppwrite(page)
    await uploadModel(page, 'E2Eの学習')
    // The page opens a moment before the folder record is written, so wait for it.
    const savedFolder = () => fake.rows('data_records').find((row) => row.category === 'E2Eの学習')
    await expect.poll(savedFolder).toBeTruthy()
    expect(savedFolder()?.file).toBe('vessel.stl')
  })
})

test.describe('lesion analysis page', () => {
  test('only the proximal and distal diameters can be edited', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'E2Eの学習')
    for (const label of ['狭窄長', '最小断面積', '最小血管径', '狭窄率', '病変位置']) {
      await expect(field(page, label)).toHaveJSProperty('readOnly', true)
    }
    await expect(field(page, '病変近位径')).toHaveJSProperty('readOnly', false)
    await expect(field(page, '病変遠位径')).toHaveJSProperty('readOnly', false)
  })

  test('the layout: menu on the left, vertical block labels, 血圧 on one line', async ({
    page,
  }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'E2Eの学習')

    // The global menu is a column down the left edge; there is no top bar.
    const sidebar = (await page.locator('aside').boundingBox())!
    expect(sidebar.x).toBe(0)
    expect(sidebar.height).toBeGreaterThan(sidebar.width * 4)
    await expect(page.locator('header')).toBeHidden()

    // The four blocks are named by labels written vertically at their left edge.
    for (const name of ['3Dビュアー', '選択病変 形状', '測定', '保存一覧']) {
      const label = page.getByText(name, { exact: true })
      await expect(label).toBeVisible()
      expect(await label.evaluate((el) => getComputedStyle(el.parentElement!).writingMode)).toBe(
        'vertical-rl',
      )
    }
    await expect(page.getByText('3Dブロック')).toHaveCount(0)

    // The 3D viewer block takes 2/3 of the width, the 選択病変 形状 block 1/3.
    const widthOf = async (name: string) =>
      (await page
        .getByText(name, { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
        .boundingBox())!.width
    const viewerWidth = await widthOf('3Dビュアー')
    const valuesWidth = await widthOf('選択病変 形状')
    expect(viewerWidth / (viewerWidth + valuesWidth)).toBeCloseTo(2 / 3, 1)

    // The name 血圧 and its value are side by side.
    const name = (await page.getByText('血圧', { exact: true }).boundingBox())!
    const value = (await page.locator('input[type=number]').first().boundingBox())!
    expect(Math.abs(name.y + name.height / 2 - (value.y + value.height / 2))).toBeLessThan(12)
    expect(value.x).toBeGreaterThan(name.x)

    // The name of the label and its value are close: no wide gap in the rows.
    const label = (await page.getByText('病変近位径', { exact: true }).boundingBox())!
    const box = (await field(page, '病変近位径').boundingBox())!
    expect(box.x - (label.x + label.width)).toBeLessThan(100)
  })

  test('two points on the vessel are measured', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'E2Eの学習')

    await page.getByTitle('2点をクリックして選択（①心臓に近い側 → ②遠い側）').click()
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
    const box = (await canvas.boundingBox())!
    // The test vessel lies across the middle of the view, rising to the right,
    // with its narrow part between these two spots (as fractions of the view).
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)

    await page.getByRole('button', { name: '測定範囲を更新' }).click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 40_000 })
    await expect(field(page, '最小断面積')).not.toHaveValue('')
    const length = Number(await field(page, '狭窄長').inputValue())
    expect(length).toBeGreaterThan(0)
  })
})

test.describe('Pa and Pd boxes', () => {
  test('appear together with the FFR result, not before', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'Pa Pd の学習')
    const boxes = page.getByText(/^(Pa|Pd)$/)
    // No empty boxes before the measurement.
    await expect(boxes).toHaveCount(0)

    await page.getByTitle('2点をクリックして選択（①心臓に近い側 → ②遠い側）').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: '測定範囲を更新' }).click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 40_000 })
    await page.locator('input[type=number]').first().fill('100')
    // Measured and the blood pressure typed, but FFR not calculated yet: still none.
    await expect(boxes).toHaveCount(0)

    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await expect(boxes).toHaveCount(2, { timeout: 20_000 })
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible()
    await expect(page.getByText('100', { exact: true }).first()).toBeVisible()
  })
})

test.describe('font size (文字サイズ)', () => {
  const rootSize = (page: Page) =>
    page.evaluate(() => getComputedStyle(document.documentElement).fontSize)

  test('is in the user menu for everyone, scales the page and is remembered', async ({ page }) => {
    // A general user, not an admin: the setting is not an admin-only one.
    await useFakeAppwrite(page, { category: 'learning_user' })
    await page.goto('/help')
    expect(await rootSize(page)).toBe('16px')

    await page.getByRole('button', { name: 'E2E Admin' }).click()
    await page.getByRole('radio', { name: '大' }).click()
    expect(await rootSize(page)).toBe('18px')
    await expect(page.getByRole('radio', { name: '大' })).toHaveAttribute('aria-checked', 'true')

    await page.reload()
    expect(await rootSize(page)).toBe('18px')

    await page.getByRole('button', { name: 'E2E Admin' }).click()
    await page.getByRole('radio', { name: '小' }).click()
    expect(await rootSize(page)).toBe('14px')
  })
})

test.describe('documents page (資料)', () => {
  test('a saved folder with no file is listed', async ({ page }) => {
    await useFakeAppwrite(page, {
      tables: {
        document_folders: [{ $id: 'folder-1', name: '空のフォルダ' }],
        documents: [
          { $id: 'doc-1', date: '2026/11/01', fileName: '資料A', folder: '使用中のフォルダ' },
        ],
      },
    })
    await page.goto('/documents')
    await expect(page.getByText('空のフォルダ')).toBeVisible()
    await expect(page.getByText('ファイルがありません')).toBeVisible()
    await expect(page.getByText('資料A')).toBeVisible()
  })
})

test.describe('the saved list (保存一覧)', () => {
  test('a saved row shows the columns in the agreed order', async ({ page }) => {
    const fake = await useFakeAppwrite(page)
    await uploadModel(page, '保存一覧の学習')
    await page.getByTitle('2点をクリックして選択（①心臓に近い側 → ②遠い側）').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: '測定範囲を更新' }).click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 40_000 })
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()

    // The button and the list are called 保存 / 保存一覧 (no longer 仮保存).
    await expect(page.getByText('仮保存')).toHaveCount(0)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 })

    const headers = await page.locator('thead th').allInnerTexts()
    expect(headers).toEqual([
      '画像',
      '病変近位径',
      '病変遠位径',
      'Pd',
      'Pa',
      'FFR',
      '狭窄率',
      '最小血管径',
      '最小断面積',
      '狭窄長',
      '病変位置',
      '編集',
      '削除',
    ])
    const cells = await page.locator('tbody tr td').allInnerTexts()
    expect(cells[3]).toMatch(/mmHg$/) // Pd
    expect(cells[5]).toMatch(/^0[.][0-9]{2}$/) // FFR = Pd / Pa
    expect(cells[6]).toMatch(/%$/) // 狭窄率
    expect(cells[10]).toMatch(/^(近位|中間|遠位)$/) // 病変位置
    // 保存 stores the row in the folder (the database), linked to it, so it is still
    // there when the folder is opened again; there is no separate history button.
    const saved = fake.rows('learning_content_frames')
    expect(saved).toHaveLength(1)
    expect(saved[0].dataRecordId).toBeTruthy()
    expect(saved[0].lesionPosition).toMatch(/^(近位|中間|遠位)$/)
    await expect(page.getByRole('button', { name: '解析履歴に保存' })).toHaveCount(0)
    await expect(page.locator('tbody').getByTitle('保存済みキャプチャを開く')).toBeEnabled()
    // A wide list scrolls sideways.
    const scroller = page.locator('.pill-scrollbar').last()
    expect(await scroller.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto')
  })

  test('編集 brings back the lesion selection as it was when 保存 was clicked', async ({
    page,
  }) => {
    const fake = await useFakeAppwrite(page)
    await uploadModel(page, '編集で戻す学習')
    await page.getByTitle('2点をクリックして選択（①心臓に近い側 → ②遠い側）').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: '測定範囲を更新' }).click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 40_000 })
    const measured = await field(page, '病変近位径').inputValue()
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 })

    // 保存 kept the view with the row: ① ②, the camera and the blood pressure.
    const row = fake.rows('learning_content_frames')[0]
    const kept = JSON.parse(String(row.viewState))
    expect(kept.annotations).toHaveLength(2)
    expect(kept.annotations[0].worldPoint).toHaveLength(3)
    expect(kept.cameraState.position).toHaveLength(3)
    expect(kept.bloodPressure).toBe('100')

    // Start over, then 編集: the selection, the values and the FFR come back, and the
    // page is the live analysis (not a 保存済みキャプチャ), so it can be edited on.
    await page.getByTitle('リセットして選択をやり直す').click()
    await expect(field(page, '病変近位径')).toHaveValue('')
    await page.locator('tbody').getByTitle('保存済みキャプチャを開く').click()
    await expect(field(page, '病変近位径')).toHaveValue(measured, { timeout: 40_000 })
    await expect(page.getByText('保存済みキャプチャ')).toHaveCount(0)
    await expect(page.locator('input[type=number]').first()).toHaveValue('100')
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: '測定範囲を更新' })).toBeVisible()
  })

  test('a folder shows every row saved in it, not only the first 25', async ({ page }) => {
    const image = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
    const frames = Array.from({ length: 30 }, (_, i) => ({
      $id: `frame-${i + 1}`,
      dataRecordId: 'record-a',
      image,
      upstreamSize: `${i + 1} mm`,
      downstreamSize: '4 mm',
      pa: '100 mmHg',
      pd: '80 mmHg',
      parameter: '20 mmHg',
    }))
    // Another folder's row must not show up.
    frames.push({
      ...frames[0],
      $id: 'frame-other',
      dataRecordId: 'record-b',
      upstreamSize: '99 mm',
    })
    await useFakeAppwrite(page, { tables: { learning_content_frames: frames } })
    await page.goto('/help')
    await page.getByText('ヘルプ').first().waitFor()
    await page.evaluate((image) => {
      window.history.pushState(
        {
          usr: {
            dataRecordId: 'record-a',
            viewFrame: {
              id: 'frame-1',
              dataRecordId: 'record-a',
              image,
              upstreamSize: '1 mm',
              downstreamSize: '4 mm',
              pa: '100 mmHg',
              pd: '80 mmHg',
              parameter: '20 mmHg',
            },
          },
          key: 'many',
          idx: 5,
        },
        '',
        '/data/lesion-measurement/analysis',
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, image)
    // Waits for the final list: all 30 of this folder's rows and none of the other's.
    await expect
      .poll(
        async () => {
          const rows = await page.locator('tbody tr').allInnerTexts()
          return { count: rows.length, other: rows.some((row) => row.includes('99 mm')) }
        },
        { timeout: 20_000 },
      )
      .toEqual({ count: 30, other: false })
  })

  test('編集 opens a saved row', async ({ page }) => {
    await useFakeAppwrite(page, {
      tables: {
        learning_content_frames: [
          {
            $id: 'frame-1',
            dataRecordId: 'record-a',
            image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
            upstreamSize: '4.92 mm',
            downstreamSize: '4.97 mm',
            pa: '100 mmHg',
            pd: '78.4 mmHg',
            parameter: '21.6 mmHg',
            mld: '1.59 mm',
            mla: '1.99 mm²',
            stenosisRate: '68 %',
            avgDiameter: '4.9 mm',
            segmentLength: '1.98 mm',
            lesionPosition: '中間',
          },
        ],
      },
    })
    await page.goto('/help')
    await page.getByText('ヘルプ').first().waitFor()
    // Opens the saved-capture page the way the learning-content list does.
    await page.evaluate(() => {
      window.history.pushState(
        {
          usr: {
            dataRecordId: 'record-a',
            viewFrame: {
              id: 'frame-1',
              dataRecordId: 'record-a',
              image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
              upstreamSize: '1 mm',
              downstreamSize: '1 mm',
              pa: '1 mmHg',
              pd: '1 mmHg',
              parameter: '0 mmHg',
            },
          },
          key: 'a',
          idx: 5,
        },
        '',
        '/data/lesion-measurement/analysis',
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    await expect(page.getByText('保存済みキャプチャ')).toBeVisible()
    const row = page.locator('tbody tr').filter({ hasText: '4.92 mm' })
    await expect(row).toBeVisible()
    // FFR is Pd / Pa: 78.4 / 100.
    await expect(row.locator('td').nth(5)).toHaveText('0.78')
    await expect(row.locator('td').nth(7)).toHaveText('1.59 mm')
    // The pencil opens that saved row: its values are now the ones shown.
    await row.getByTitle('保存済みキャプチャを開く').click()
    await expect(field(page, '病変近位径')).toHaveValue('4.92')
    await expect(field(page, '病変位置')).toHaveValue('中間')
  })
})

test.describe('a model exported in metres', () => {
  test('is shown and measured in mm, like one exported in mm', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'メートルの学習', 1000)

    await page.getByTitle('2点をクリックして選択（①心臓に近い側 → ②遠い側）').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: '測定範囲を更新' }).click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 40_000 })

    // The test vessel is 5 mm wide, so the diameters are about 5, not 0.005.
    for (const label of ['病変近位径', '病変遠位径']) {
      const value = Number(await field(page, label).inputValue())
      expect(value).toBeGreaterThan(3)
      expect(value).toBeLessThan(6)
    }
    expect(Number(await field(page, '狭窄長').inputValue())).toBeGreaterThan(0.5)
    // No "this model looks like metres" error any more.
    await expect(page.getByText('メートル（m）単位の可能性')).toHaveCount(0)
  })
})

test.describe('help page', () => {
  test('describes the current screens', async ({ page }) => {
    await useFakeAppwrite(page)
    await page.goto('/help')
    const text = await page.locator('main').innerText()
    expect(text).toContain('3D狭窄形状プレビュー')
    expect(text).toContain('格子')
    expect(text).toContain('画面の左側')
    expect(text).not.toContain('形状ブロック')
    expect(text).toContain('自動で1000倍に拡大')
    expect(text).not.toContain('学習範囲を外れてしまいます')
    // Texts that were removed from the app must not come back.
    expect(text).not.toContain('宇宙')
    expect(text).not.toContain('生成される3D狭窄形状')
  })
})
