import { expect, test, type Page } from '@playwright/test'

import { useFakeAppwrite } from './support/fakeAppwrite'
import { makeStenosisStl } from './support/stenosisModel'

// The value box of a row in the 選択病変 panel, found by the row's label.
function field(page: Page, label: string) {
  return page.locator(
    `xpath=//span[normalize-space(.)="${label}"]/ancestor::div[@data-lesion-field][1]//input`,
  )
}

async function uploadModel(page: Page, studyName: string, unit = 1, spread = 3) {
  await page.goto('/data/3d-analysis')
  await page.getByLabel('学習名').fill(studyName)
  await page.locator('input[type=file]').setInputFiles({
    name: 'vessel.stl',
    mimeType: 'application/octet-stream',
    buffer: makeStenosisStl(unit, spread),
  })
  await page.waitForURL('**/data/lesion-measurement/analysis')
  await expect(page.getByText('3D狭窄形状プレビュー')).toBeVisible()
}

// Selects ① and ② on the test vessel and waits for the measurement.
async function measureLesion(page: Page) {
  await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
  const box = (await page.locator('canvas').first().boundingBox())!
  await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
  await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
  await page.getByRole('button', { name: /^④/ }).click()
  await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 40_000 })
}

test.describe('folder list (3D解析)', () => {
  test('an admin sees the folders the fake server holds', async ({ page }) => {
    await useFakeAppwrite(page)
    await page.goto('/data')
    await expect(page.getByRole('heading', { name: '3D解析' })).toBeVisible()
    await expect(page.getByText('テスト用の学習 A')).toBeVisible()
    await expect(page.getByText('テスト用の学習 B')).toBeVisible()
  })

  test('the newest folder is at the top of the list', async ({ page }) => {
    const row = (id: string, name: string, createdAt: string) => ({
      $id: id,
      $createdAt: createdAt,
      date: '2026/11/01',
      category: name,
      file: `${id}.stl`,
      owner: 'E2E Admin',
    })
    await useFakeAppwrite(page, {
      tables: {
        data_records: [
          row('old', '一番古いフォルダ', '2026-11-01T09:00:00.000+00:00'),
          row('middle', '真ん中のフォルダ', '2026-11-05T09:00:00.000+00:00'),
          row('new', '一番新しいフォルダ', '2026-11-10T09:00:00.000+00:00'),
        ],
      },
    })
    await page.goto('/data')
    await expect(page.locator('tbody tr')).toHaveCount(3)
    const known = ['一番新しいフォルダ', '真ん中のフォルダ', '一番古いフォルダ']
    const names = (await page.locator('tbody tr').allInnerTexts()).map((text) =>
      known.find((name) => text.includes(name)),
    )
    expect(names).toEqual(known)
  })

  test('a folder created now appears above the older ones', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '作ったばかりのフォルダ')
    await page.goto('/data')
    // The two folders the fake starts with are older than the one just made.
    await expect(page.locator('tbody tr')).toHaveCount(3)
    await expect(page.locator('tbody tr').first()).toContainText('作ったばかりのフォルダ')
  })

  test("a folder's ✏️ list shows only the captures saved in that folder", async ({ page }) => {
    const image = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
    const frame = (id: string, folder: string, upstream: string) => ({
      $id: id,
      dataRecordId: folder,
      image,
      upstreamSize: upstream,
      downstreamSize: '4 mm',
      pa: '100 mmHg',
      pd: '80 mmHg',
      parameter: '20 mmHg',
    })
    const fake = await useFakeAppwrite(page, {
      tables: {
        learning_content_frames: [
          frame('a1', 'record-a', '11 mm'),
          frame('a2', 'record-a', '12 mm'),
          frame('a3', 'record-a', '13 mm'),
          frame('b1', 'record-b', '21 mm'),
          frame('b2', 'record-b', '22 mm'),
          // Saved before captures were linked to a folder: in no folder's list.
          { ...frame('old', 'x', '31 mm'), dataRecordId: undefined },
        ],
      },
    })
    const openFolderList = async (folderId: string) => {
      await page.evaluate((id) => {
        window.history.pushState(
          {
            usr: { dataRecordId: id },
            key: 'folder-' + id,
            idx: (window.history.state?.idx ?? 0) + 1,
          },
          '',
          '/data/learning-content',
        )
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
      }, folderId)
    }
    await page.goto('/help')
    await page.getByText('ヘルプ').first().waitFor()

    // A folder with captures lists its own and nobody else's.
    await openFolderList('record-a')
    await expect(page.locator('tbody tr')).toHaveCount(3)
    await expect(page.locator('tbody')).toContainText('11 mm')
    await expect(page.locator('tbody')).not.toContainText('21 mm')
    await expect(page.locator('tbody')).not.toContainText('31 mm')

    // A folder created now, with nothing saved in it, lists nothing.
    await uploadModel(page, '作ったばかりの空のフォルダ')
    await expect.poll(() => fake.rows('data_records').length).toBeGreaterThan(2)
    const created = fake
      .rows('data_records')
      .find((row) => row.category === '作ったばかりの空のフォルダ')!
    await openFolderList(created.$id)
    await expect(page.getByText('該当するデータが見つかりません')).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(0)
  })

  test("a saved capture's file name starts as a timestamp and can be changed", async ({ page }) => {
    const image = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
    const savedAt = '2026-11-10T09:15:30.000+00:00'
    const frame = (id: string, extra: Record<string, unknown>) => ({
      $id: id,
      $createdAt: savedAt,
      dataRecordId: 'record-a',
      image,
      upstreamSize: '11 mm',
      downstreamSize: '4 mm',
      pa: '100 mmHg',
      pd: '80 mmHg',
      parameter: '20 mmHg',
      ...extra,
    })
    const fake = await useFakeAppwrite(page, {
      tables: {
        learning_content_frames: [
          frame('named', { fileName: '術前の撮影' }),
          frame('unnamed', {}),
        ],
      },
    })
    await page.goto('/help')
    await page.getByText('ヘルプ').first().waitFor()
    await page.evaluate(() => {
      window.history.pushState(
        { usr: { dataRecordId: 'record-a' }, key: 'folder-a', idx: (window.history.state?.idx ?? 0) + 1 },
        '',
        '/data/learning-content',
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    await expect(page.locator('tbody tr')).toHaveCount(2)

    // The same moment as the row's saving time, in this computer's time zone.
    const expected = await page.evaluate((iso) => {
      const d = new Date(iso)
      const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    }, savedAt)
    const names = page.locator('tbody tr td:first-child input')
    const values = await names.evaluateAll((inputs) => (inputs as HTMLInputElement[]).map((input) => input.value))
    expect([...values].sort()).toEqual(['術前の撮影', expected].sort())

    // A name that was given stays; any of them can be changed, and is kept.
    const unnamed = names.nth(values.indexOf(expected))
    await unnamed.fill('術後の撮影')
    await unnamed.blur()
    await expect.poll(() => fake.rows('learning_content_frames').map((row) => row.fileName).sort()).toEqual(
      ['術前の撮影', '術後の撮影'].sort(),
    )

    // Emptying a name brings the timestamp back.
    await unnamed.fill('')
    await unnamed.blur()
    await expect(unnamed).toHaveValue(expected)
  })

  test("編集 in the folder's list opens the editable analysis with its file name at the top left", async ({
    page,
  }) => {
    const image = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
    await useFakeAppwrite(page, {
      tables: {
        learning_content_frames: [
          {
            $id: 'f1',
            dataRecordId: 'record-a',
            fileName: '術前の撮影',
            image,
            upstreamSize: '4.71 mm',
            downstreamSize: '4.47 mm',
            pa: '80 mmHg',
            pd: '64.9 mmHg',
            parameter: '15.1 mmHg',
            mld: '1.56 mm',
            mla: '1.92 mm²',
            stenosisRate: '66 %',
            segmentLength: '2.09 mm',
            lesionPosition: '中間',
          },
        ],
      },
    })
    await page.goto('/help')
    await page.getByText('ヘルプ').first().waitFor()
    await page.evaluate(() => {
      window.history.pushState(
        { usr: { dataRecordId: 'record-a' }, key: 'folder-a', idx: (window.history.state?.idx ?? 0) + 1 },
        '',
        '/data/learning-content',
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    // Aki 11/25: 編集 opens the same analysis as a new one, not a picture. This folder has no
    // stored 3D model, so the file is asked for once; the row's blood pressure comes in and
    // ① ② are to be chosen again.
    const chooser = page.waitForEvent('filechooser')
    await page.locator('tbody').getByTitle('編集').click()
    await (await chooser).setFiles({
      name: 'vessel.stl',
      mimeType: 'application/octet-stream',
      buffer: makeStenosisStl(1, 3),
    })
    await page.waitForURL('**/data/lesion-measurement/analysis')
    await expect(page.getByTitle('編集中の保存データのファイル名')).toHaveText('術前の撮影')
    await expect(page.getByText(/①②の位置が残っていない/)).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('input[type=number]').first()).toHaveValue('80')
    await expect(page.getByRole('button', { name: /^① 近位径/ })).toBeEnabled()
    await expect(page.getByText('保存済みキャプチャ', { exact: true })).toHaveCount(0)
  })

  test("編集 in the folder's list brings back ① ② when the row kept them, and needs no file", async ({
    page,
  }) => {
    test.setTimeout(150_000)
    const fake = await useFakeAppwrite(page)
    // The fake does not keep uploaded bytes: the folder's stored model is the test vessel again.
    await page.route('**/files/*/view*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from(makeStenosisStl(1, 3)) }),
    )
    await uploadModel(page, '一覧から編集する学習')
    // The canvas is at its size and the model has faded in before the clicks.
    await expect
      .poll(async () => (await page.locator('canvas').first().boundingBox())?.width ?? 0)
      .toBeGreaterThan(500)
    await page.waitForTimeout(3000)
    await measureLesion(page)
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 })
    const measured = await field(page, '病変近位径').inputValue()
    const folderId = String(fake.rows('learning_content_frames')[0].dataRecordId)

    await page.evaluate((id) => {
      window.history.pushState(
        { usr: { dataRecordId: id }, key: 'folder-b', idx: (window.history.state?.idx ?? 0) + 1 },
        '',
        '/data/learning-content',
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, folderId)
    // The folder's details have come in (its model is known) before 編集 is clicked.
    await expect(page.getByText(/vessel.stl/)).toBeVisible()
    await page.locator('tbody').getByTitle('編集').click()
    // The folder's stored model comes back (no file chooser), with the row's selection and FFR.
    await expect(field(page, '病変近位径')).toHaveValue(measured, { timeout: 60_000 })
    await expect(page.getByText('保存済みキャプチャ', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 20_000 })
  })

  test('PDFダウンロード makes a report with the values on screen', async ({ page }) => {
    await useFakeAppwrite(page)
    // No print dialog in the test; the report is read instead.
    await page.context().addInitScript(() => {
      window.print = () => {
        ;(window as unknown as { printed: boolean }).printed = true
      }
    })
    await uploadModel(page, 'PDFの学習')
    await measureLesion(page)
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 40_000 })

    const [report] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'PDFダウンロード' }).click(),
    ])
    await expect(report.locator('section tr')).not.toHaveCount(0, { timeout: 20_000 })
    // Nothing is saved in this folder yet: one section, for what is on screen.
    await expect(report.locator('section')).toHaveCount(1)
    const rows = await report.locator('section tr').evaluateAll((trs) =>
      Object.fromEntries(trs.map((tr) => [tr.children[0].textContent, tr.children[1].textContent])),
    )
    expect(rows['ファイル名']).toBe('vessel.stl')
    expect(rows['Pa']).toBe('100 mmHg')
    expect(rows['Pd']).toMatch(/^[0-9.]+ mmHg$/)
    expect(rows['FFR']).toMatch(/^0\.[0-9]{2}$/)
    expect(rows['病変近位径']).toMatch(/^[0-9.]+ mm$/)
    expect(rows['病変遠位径']).toMatch(/^[0-9.]+ mm$/)
    expect(rows['狭窄率']).toMatch(/^[0-9.]+ %$/)
    expect(rows['最小断面積']).toMatch(/mm²$/)
    expect(rows['病変位置']).toMatch(/^(近位|中間|遠位)$/)
    // The picture of the view is in the report, and it was sent to print.
    await expect(report.locator('section img')).toHaveCount(1)
    await expect.poll(() => report.evaluate(() => (window as unknown as { printed?: boolean }).printed)).toBe(true)
  })

  test('a list says it is loading, then shows its rows', async ({ page }) => {
    await useFakeAppwrite(page, { slowReads: { data_records: 1500 } })
    await page.goto('/data')
    // While the data is on its way: a loading indicator, not "no data found".
    const loading = page.getByRole('status').filter({ hasText: 'データを読み込んでいます' })
    await expect(loading).toBeVisible()
    await expect(page.getByText('該当するデータが見つかりません')).toHaveCount(0)
    await expect(page.getByText('テスト用の学習 A')).toBeVisible({ timeout: 10_000 })
    await expect(loading).toHaveCount(0)
  })

  test("a folder's ✏️ list loads without the pictures, which follow as the rows come into view", async ({
    page,
  }) => {
    const image = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
    const frames = Array.from({ length: 30 }, (_, index) => ({
      $id: `f${index + 1}`,
      dataRecordId: 'record-a',
      image,
      upstreamSize: `${index + 1} mm`,
      downstreamSize: '4 mm',
      pa: '100 mmHg',
      pd: '80 mmHg',
      parameter: '20 mmHg',
    }))
    const fake = await useFakeAppwrite(page, {
      tables: { learning_content_frames: frames },
      slowReads: { learning_content_frames: 800 },
    })
    await page.goto('/help')
    await page.getByText('ヘルプ').first().waitFor()
    const listResponse = page.waitForResponse((response) =>
      /tables\/learning_content_frames\/rows\?/.test(response.url()),
    )
    await page.evaluate(() => {
      window.history.pushState(
        { usr: { dataRecordId: 'record-a' }, key: 'folder-a', idx: (window.history.state?.idx ?? 0) + 1 },
        '',
        '/data/learning-content',
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })

    // The list is on its way: a loading indicator rather than "no data".
    await expect(page.getByRole('status').filter({ hasText: 'データを読み込んでいます' })).toBeVisible()
    // The rows come without their pictures.
    const body = (await (await listResponse).json()) as { rows: Record<string, unknown>[] }
    expect(body.rows).toHaveLength(30)
    expect(body.rows.every((row) => row.image === undefined)).toBe(true)
    expect(body.rows[0].upstreamSize).toBeTruthy()
    await expect(page.locator('tbody tr')).toHaveCount(30)

    // The pictures of the rows on screen arrive; not every row's.
    await expect(page.locator('tbody tr').first().locator('img')).toHaveAttribute('src', /^data:image/, {
      timeout: 15_000,
    })
    const pictureReads = () => fake.requests.filter((request) => /\/rows\/f[0-9]+$/.test(request)).length
    expect(pictureReads()).toBeLessThan(30)
    // Scrolling down brings the last row's picture.
    await page.locator('tbody tr').last().scrollIntoViewIfNeeded()
    await expect(page.locator('tbody tr').last().locator('img')).toHaveAttribute('src', /^data:image/, {
      timeout: 15_000,
    })
  })

  test('PDFダウンロード puts every capture saved in the folder in one report', async ({ page }) => {
    const image = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
    const frame = (id: string, name: string, created: string, upstream: string) => ({
      $id: id,
      $createdAt: created,
      dataRecordId: 'record-a',
      fileName: name,
      image,
      upstreamSize: upstream,
      downstreamSize: '4 mm',
      pa: '100 mmHg',
      pd: '80 mmHg',
      parameter: '20 mmHg',
      mld: '1.5 mm',
      mla: '1.9 mm²',
      stenosisRate: '66 %',
      segmentLength: '2 mm',
      lesionPosition: '中間',
    })
    const fake = await useFakeAppwrite(page, {
      tables: {
        learning_content_frames: [
          frame('c1', '撮影A', '2026-11-10T09:00:00.000+00:00', '11 mm'),
          frame('c2', '撮影B', '2026-11-10T10:00:00.000+00:00', '12 mm'),
          frame('c3', '撮影C', '2026-11-10T11:00:00.000+00:00', '13 mm'),
        ],
      },
    })
    await page.context().addInitScript(() => {
      window.print = () => {
        ;(window as unknown as { printed: boolean }).printed = true
      }
    })
    await page.goto('/help')
    await page.getByText('ヘルプ').first().waitFor()
    await page.evaluate(() => {
      window.history.pushState(
        { usr: { dataRecordId: 'record-a' }, key: 'folder-a', idx: (window.history.state?.idx ?? 0) + 1 },
        '',
        '/data/learning-content',
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    // Open one of the captures (the folder has no stored model, so its file is asked for):
    // the report is still of all of them, not of this one.
    const chooser = page.waitForEvent('filechooser')
    await page.locator('tbody').getByTitle('編集').first().click()
    await (await chooser).setFiles({
      name: 'vessel.stl',
      mimeType: 'application/octet-stream',
      buffer: makeStenosisStl(1, 3),
    })
    await expect(page.getByRole('button', { name: 'PDFダウンロード' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(3, { timeout: 20_000 })

    const [report] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'PDFダウンロード' }).click(),
    ])
    await expect(report.locator('section')).toHaveCount(3, { timeout: 20_000 })
    // Newest first, as the list shows them; each with its picture and its values.
    const headings = await report.locator('section h2').allInnerTexts()
    expect(headings).toEqual(['撮影C', '撮影B', '撮影A'])
    await expect(report.locator('section img')).toHaveCount(3)
    const first = await report.locator('section').first().locator('tr').evaluateAll((trs) =>
      Object.fromEntries(trs.map((tr) => [tr.children[0].textContent, tr.children[1].textContent])),
    )
    expect(first['病変近位径']).toBe('13 mm')
    expect(first['Pa']).toBe('100 mmHg')
    expect(first['FFR']).toBe('0.80')
    expect(first['病変位置']).toBe('中間')
    // The pictures were fetched for it, one request each, and it was sent to print.
    await expect.poll(() => fake.requests.filter((request) => /\/rows\/c[0-9]$/.test(request)).length).toBeGreaterThanOrEqual(3)
    await expect.poll(() => report.evaluate(() => (window as unknown as { printed?: boolean }).printed)).toBe(true)
    await expect(report.locator('h1')).toHaveText('3D医療モデル分析レポート')
    await expect(report.locator('.subtitle')).toContainText('3件')
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

    // No unnecessary space above the title at the very top (Aki 11/24).
    const top = (await page.getByTestId('lesion-page').locator('xpath=./*[1]').boundingBox())!
    expect(top.y).toBeLessThan(16)

    // The four blocks are named by labels written vertically at their left edge.
    for (const name of ['3Dビュアー', '計測値・形状', '測定', '解析結果一覧']) {
      const label = page.getByText(name, { exact: true })
      await expect(label).toBeVisible()
      expect(await label.evaluate((el) => getComputedStyle(el.parentElement!).writingMode)).toBe(
        'vertical-rl',
      )
    }
    await expect(page.getByText('3Dブロック')).toHaveCount(0)

    // They are index tabs (Aki 11/25, her drawing of 11/26): each is a square tab that sticks out
    // of its block's left edge, flush with the block's top, joined to the block; only as tall as
    // its name.
    const blockOf = (name: string) =>
      page.getByText(name, { exact: true }).locator('xpath=ancestor::div[@data-block][1]/div[contains(@class,"rounded-2xl")]')
    for (const name of ['3Dビュアー', '計測値・形状']) {
      const tab = (await page.getByText(name, { exact: true }).locator('xpath=..').boundingBox())!
      const block = (await blockOf(name).boundingBox())!
      expect(tab.x).toBeLessThan(block.x) // outside the block, at its left
      expect(tab.x + tab.width).toBeGreaterThan(block.x - 2) // touching it
      expect(Math.abs(tab.y - block.y)).toBeLessThan(2) // flush with the top
      expect(tab.height).toBeLessThan(block.height / 2)
      expect(
        await page.getByText(name, { exact: true }).locator('xpath=..').evaluate((el) => {
          const style = getComputedStyle(el)
          return [style.borderTopLeftRadius, style.borderBottomLeftRadius, style.borderTopRightRadius]
        }),
      ).toEqual(['8px', '8px', '0px']) // the outer corners slightly rounded (Aki 11/26); the side at the block is straight
      // The block's own top-left corner is square too, so the top edge runs straight on from the tab.
      expect(await blockOf(name).evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe('0px')
    }

    // Room inside every tab, so the name is not cut off (Aki 11/25): space above and below it.
    for (const name of ['3Dビュアー', '計測値・形状', '測定', '解析結果一覧']) {
      const room = await page.getByText(name, { exact: true }).evaluate((text) => {
        const range = document.createRange()
        range.selectNodeContents(text)
        const inner = range.getBoundingClientRect()
        const tab = text.parentElement!.getBoundingClientRect()
        return { top: inner.top - tab.top, bottom: tab.bottom - inner.bottom, sides: Math.min(inner.left - tab.left, tab.right - inner.right) }
      })
      expect(room.top).toBeGreaterThanOrEqual(10)
      expect(room.bottom).toBeGreaterThanOrEqual(10)
      expect(room.sides).toBeGreaterThanOrEqual(1)
    }

    // The 3D viewer block takes 2/3 of the width, the 計測値・形状 block 1/3.
    const widthOf = async (name: string) => (await blockOf(name).boundingBox())!.width
    const viewerWidth = await widthOf('3Dビュアー')
    const valuesWidth = await widthOf('計測値・形状')
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

    // The values are in pairs, in two columns: 近位径 | 遠位径, 最小血管径 | 最小断面積,
    // 病変位置 on its own, 狭窄率 | 狭窄長.
    const rowOf = async (label: string) => (await field(page, label).boundingBox())!
    const [proximal, distal, minDiameter, minArea, position, rate, length] = await Promise.all(
      ['病変近位径', '病変遠位径', '最小血管径', '最小断面積', '病変位置', '狭窄率', '狭窄長'].map(
        rowOf,
      ),
    )
    const sameRow = (a: { y: number }, b: { y: number }) => Math.abs(a.y - b.y) < 6
    expect(sameRow(proximal, distal) && distal.x > proximal.x + proximal.width).toBe(true)
    expect(sameRow(minDiameter, minArea) && minArea.x > minDiameter.x + minDiameter.width).toBe(
      true,
    )
    expect(sameRow(rate, length) && length.x > rate.x + rate.width).toBe(true)
    expect(minDiameter.y).toBeGreaterThan(proximal.y + 10)
    expect(position.y).toBeGreaterThan(minDiameter.y + 10)
    expect(rate.y).toBeGreaterThan(position.y + 10)
  })

  test('the page has narrow, equal margins at its left and right edges', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await useFakeAppwrite(page)
    await uploadModel(page, '余白の学習')

    const sidebar = (await page.locator('aside').boundingBox())!
    const blocks = page.locator('[data-testid="lesion-page"] div.rounded-2xl')
    const count = await blocks.count()
    let leftEdge = Infinity
    let rightEdge = 0
    for (let i = 0; i < count; i++) {
      const box = await blocks.nth(i).boundingBox()
      if (!box || box.width < 200) continue
      leftEdge = Math.min(leftEdge, box.x)
      rightEdge = Math.max(rightEdge, box.x + box.width)
    }
    const viewport = page.viewportSize()!
    const left = leftEdge - (sidebar.x + sidebar.width)
    const right = viewport.width - rightEdge
    // 24 px each side (it was 56 px), and no horizontal scrollbar.
    expect(left).toBeGreaterThanOrEqual(20)
    expect(left).toBeLessThanOrEqual(28)
    expect(Math.abs(left - right)).toBeLessThanOrEqual(20) // the right one may include a scrollbar
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })

  test('the controls in the 3D view are laid out as in the wireframe', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '配置の学習')
    // The canvas starts at its default size and is resized a moment later: wait for that.
    await expect
      .poll(async () => (await page.locator('canvas').first().boundingBox())?.width ?? 0)
      .toBeGreaterThan(500)
    const view = (await page.locator('canvas').first().boundingBox())!
    const button = async (name: string | RegExp) => (await page.getByRole('button', { name }).first().boundingBox())!
    const atTitle = async (title: string) => (await page.getByTitle(title, { exact: true }).boundingBox())!

    // Along the top, left to right, in the order of the work (Aki's wireframe of 11/25):
    // リセット → ① 近位径 → ② 遠位径 → ③ 病変調整 → ④ 計測, all in the 3D view and on one line.
    const row = [
      await button('リセット'),
      await button(/^① 近位径/),
      await button(/^② 遠位径/),
      await button(/^③ 病変調整/),
      await button(/^④ 計測/),
    ]
    for (let index = 1; index < row.length; index += 1) {
      expect(row[index].x).toBeGreaterThan(row[index - 1].x + row[index - 1].width - 1)
    }
    for (const box of row) {
      expect(box.y).toBeGreaterThanOrEqual(view.y)
      expect(box.y + box.height).toBeLessThan(view.y + 90)
      expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width)
    }
    // Text buttons carry no icon (Aki 11/25): リセット is only its word.
    await expect(page.getByRole('button', { name: 'リセット', exact: true }).locator('svg')).toHaveCount(0)
    // The old names are gone from the top row, and the single turn / move button is gone
    // from the right column (Aki 11/25: 回転 / 移動 are under ①, see the next test).
    await expect(page.getByRole('button', { name: /病変指定|整列|測定範囲を更新/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /ドラッグでモデルを.*切り替え/ })).toHaveCount(0)

    // Down the right edge, top to bottom: ＋, －, 全画面, the same space between each (Aki 11/26).
    const column = [await atTitle('拡大'), await atTitle('縮小'), await atTitle('全画面')]
    for (let index = 1; index < column.length; index += 1) {
      expect(column[index].y).toBeGreaterThan(column[index - 1].y + column[index - 1].height - 1)
      expect(Math.abs(column[index].x - column[0].x)).toBeLessThan(6)
    }
    const gaps = [1, 2].map((i) => column[i].y - (column[i - 1].y + column[i - 1].height))
    expect(Math.abs(gaps[0] - gaps[1])).toBeLessThan(1)
    expect(gaps[0]).toBeGreaterThan(2)
    expect(column[0].x).toBeGreaterThan(view.x + view.width * 0.9)
    expect(row[4].y).toBeLessThan(view.y + 90)

    // The ① ② swap button is gone (Aki 11/26: no longer needed), also once both points are chosen.
    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    await page.mouse.click(view.x + view.width * 0.37, view.y + view.height * 0.575)
    await page.mouse.click(view.x + view.width * 0.63, view.y + view.height * 0.445)
    await expect(page.getByRole('button', { name: /^④ 計測/ })).toBeEnabled()
    await expect(page.getByTitle(/入れ替え/)).toHaveCount(0)
    // The depth slider appears with ③ (Aki 11/26): in a clearly visible central area of the view, in
    // an empty spot, not over the model, and not in the right column with the other controls.
    await page.getByTitle('整列して断面を表示').click()
    await expect(page.getByLabel('奥行き')).toBeVisible()
    await page.waitForTimeout(1500)
    const slider = (await page.getByLabel('奥行き').boundingBox())!
    const centreX = (slider.x + slider.width / 2 - view.x) / view.width
    const centreY = (slider.y + slider.height / 2 - view.y) / view.height
    expect(centreX).toBeGreaterThan(0.3)
    expect(centreX).toBeLessThan(0.7)
    expect(centreY).toBeGreaterThan(0.18)
    expect(centreY).toBeLessThan(0.85)
    // Not over the vessel: the picture of the 3D view under the slider is hardly any of the model.
    const covered = await page.evaluate(
      ([x, y, w, h]) => {
        const canvas = document.querySelector('canvas')!
        const box = canvas.getBoundingClientRect()
        const probe = document.createElement('canvas')
        probe.width = Math.round(w)
        probe.height = Math.round(h)
        const context = probe.getContext('2d')!
        context.drawImage(canvas, ((x - box.x) / box.width) * canvas.width, ((y - box.y) / box.height) * canvas.height, (w / box.width) * canvas.width, (h / box.height) * canvas.height, 0, 0, probe.width, probe.height)
        const data = context.getImageData(0, 0, probe.width, probe.height).data
        let model = 0
        for (let k = 0; k < data.length; k += 4) {
          if ((data[k] + data[k + 1] + data[k + 2]) / 3 > 105 && Math.max(data[k], data[k + 1], data[k + 2]) - Math.min(data[k], data[k + 1], data[k + 2]) < 30) model += 1
        }
        return model / (data.length / 4)
      },
      [slider.x, slider.y, slider.width, slider.height],
    )
    expect(covered).toBeLessThan(0.15)
  })

  test('after 計測 a hint says to enter the blood pressure and calculate the FFR (Aki 11/26)', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '血圧の案内の学習')
    const hint = page.getByText('血圧を入力して、「FFRを計算」をクリックしてください')
    await expect(hint).toHaveCount(0)
    await measureLesion(page)
    await expect(hint).toBeVisible()
    // It stands right under the ④ 計測 button, in the 3D view where the user is looking (not down by the
    // blood pressure, which can be out of the window), and the hint of ③ gives way to it.
    const measure = (await page.getByRole('button', { name: /^④ 計測/ }).boundingBox())!
    const bubble = (await hint.boundingBox())!
    expect(bubble.y).toBeGreaterThan(measure.y + measure.height - 1)
    expect(bubble.y).toBeLessThan(measure.y + measure.height + 30)
    expect(bubble.x).toBeLessThan(measure.x + measure.width)
    expect(bubble.x + bubble.width).toBeGreaterThan(measure.x)
    await expect(page.getByText('「③ 病変調整」から病変位置の詳細を調整できます')).toHaveCount(0)
    // It can be closed, and stays closed for this measurement.
    await hint.locator('xpath=ancestor::div[@role="status"][1]').getByRole('button', { name: 'ヒントを閉じる' }).click()
    await expect(hint).toHaveCount(0)
    // A new measurement shows it again; calculating the FFR takes it away.
    await page.getByRole('button', { name: 'リセット' }).click()
    await expect(hint).toHaveCount(0)
    await measureLesion(page)
    await expect(hint).toBeVisible()
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 20_000 })
    await expect(hint).toHaveCount(0)
  })

  test('回転 and 移動 are under ① while ① or ② is to be chosen (Aki 11/25)', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '回転移動の学習')
    await expect
      .poll(async () => (await page.locator('canvas').first().boundingBox())?.width ?? 0)
      .toBeGreaterThan(500)
    const view = (await page.locator('canvas').first().boundingBox())!
    const rotate = page.getByRole('button', { name: '回転', exact: true })
    const move = page.getByRole('button', { name: '移動', exact: true })
    const first = page.getByRole('button', { name: /^① 近位径/ })
    const second = page.getByRole('button', { name: /^② 遠位径/ })

    // Not together with the hint over ① (they would sit under it).
    await expect(rotate).toHaveCount(0)
    await first.click()
    await expect(rotate).toBeVisible()
    await expect(move).toBeVisible()
    // Stacked under ①, in its column; picking a point is on, so neither is lit.
    const firstBox = (await first.boundingBox())!
    const rotateBox = (await rotate.boundingBox())!
    const moveBox = (await move.boundingBox())!
    expect(rotateBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 1)
    expect(moveBox.y).toBeGreaterThan(rotateBox.y + rotateBox.height - 1)
    expect(Math.abs(rotateBox.x - firstBox.x)).toBeLessThan(2)
    await expect(rotate).toHaveAttribute('aria-pressed', 'false')
    await expect(move).toHaveAttribute('aria-pressed', 'false')
    await expect(rotate.locator('svg')).toHaveCount(0)
    await expect(move.locator('svg')).toHaveCount(0)

    // 移動 leaves the picking of points: a click on the model places nothing; ① goes back.
    await move.click()
    await expect(move).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.click(view.x + view.width * 0.37, view.y + view.height * 0.575)
    await expect(second).toBeDisabled()
    await rotate.click()
    await expect(rotate).toHaveAttribute('aria-pressed', 'true')
    await expect(move).toHaveAttribute('aria-pressed', 'false')
    await first.click()
    await page.mouse.click(view.x + view.width * 0.37, view.y + view.height * 0.575)
    await expect(second).toBeEnabled()
    // Still there while ② is to be chosen; gone once both points are chosen.
    await expect(rotate).toBeVisible()
    await second.click()
    await page.mouse.click(view.x + view.width * 0.63, view.y + view.height * 0.445)
    await expect(rotate).toHaveCount(0)
    await expect(move).toHaveCount(0)
  })

  test('the next control to touch glows, step by step', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '手順の学習')
    const glowing = async () =>
      (
        await page
          .locator('[data-guided="true"]')
          .evaluateAll((elements) => elements.map((element) => element.getAttribute('title') ?? element.textContent ?? ''))
      ).sort()
    const named = (...names: string[]) => names.sort()
    const sliderTitle = 'モデルの奥行きを調整（上：奥へ（最大6 mm）、下：元の位置。ダブルクリックで元の位置）'

    // ①: the start of the lesion.
    expect(await glowing()).toEqual(named('病変の始点（心臓に近い側）を選択'))

    // ① is placed: ②, the end.
    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    expect(await glowing()).toEqual(named('病変の終点（遠い側）を選択'))

    // Both points chosen: ③.
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    expect(await glowing()).toEqual(named('整列して断面を表示（線と奥行きを調整）'))

    // ③ is on: the depth slider.
    await page.getByTitle('整列して断面を表示').click()
    const slider = page.getByLabel('奥行き')
    await expect(slider).toBeVisible()
    await expect(page.locator('[data-guided="true"]')).toHaveCount(1, { timeout: 20_000 })
    expect(await glowing()).toEqual(named(sliderTitle))
    // It is in the central area of the view, not in the right column (Aki 11/26).
    const fullscreen = (await page.getByTitle('全画面', { exact: true }).boundingBox())!
    const sliderBox = (await slider.boundingBox())!
    expect(sliderBox.x + sliderBox.width).toBeLessThan(fullscreen.x)

    // The slider is used: ④ 計測.
    await slider.fill('10')
    await expect(page.locator('[data-guided="true"]')).toHaveCount(1)
    expect(await glowing()).toEqual(named('選択した2点から計測し直します（手動で修正した値は自動計測値に戻ります）'))

    // Clicked: the work is done, so the button stops glowing; only the slider glows, as
    // a reminder to check the depth (Aki 11/19), until it is used.
    await page.getByRole('button', { name: /^④/ }).click()
    await expect(page.locator('[data-guided="true"]')).toHaveCount(1)
    expect(await glowing()).toEqual(named(sliderTitle))
    await slider.fill('12')
    await expect(page.locator('[data-guided="true"]')).toHaveCount(0)
  })

  test('each step can be gone back to (Aki 11/25)', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '戻る学習')
    const step = (n: 1 | 2 | 3 | 4) =>
      page.getByRole('button', { name: [/^① 近位径/, /^② 遠位径/, /^③ 病変調整/, /^④ 計測/][n - 1] })
    // Before the points are chosen only ① can be used; ③ and ④ need both points.
    await expect(step(1)).toBeEnabled()
    await expect(step(2)).toBeDisabled()
    await expect(step(3)).toBeDisabled()
    await expect(step(4)).toBeDisabled()

    await step(1).click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await expect(step(2)).toBeEnabled()
    await expect(step(1)).not.toHaveAttribute('aria-current', 'step')
    await expect(step(2)).toHaveAttribute('aria-current', 'step')
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await expect(step(3)).toBeEnabled()
    await expect(step(4)).toBeEnabled()
    await expect(step(3)).toHaveAttribute('aria-current', 'step')

    // ③: the lines and the depth slider appear only now.
    await expect(page.getByLabel('奥行き')).toHaveCount(0)
    await step(3).click()
    await expect(page.getByLabel('奥行き')).toBeVisible()

    // ④ measures; then back to ② takes the second point away and leaves ③ (no slider).
    await step(4).click()
    await expect(page.locator('[data-lesion-field] input').first()).not.toHaveValue('', { timeout: 60_000 })
    await step(2).click()
    await expect(page.getByLabel('奥行き')).toHaveCount(0)
    await expect(page.locator('[data-lesion-field] input').first()).toHaveValue('')
    await expect(step(2)).toHaveAttribute('aria-current', 'step')
    await expect(step(3)).toBeDisabled()

    // Place the second point again, then back to ① clears both.
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await expect(step(3)).toBeEnabled()
    await step(1).click()
    await expect(step(2)).toBeDisabled()
    await expect(step(1)).toHaveAttribute('aria-current', 'step')
  })

  test('two points on the vessel are measured', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'E2Eの学習')

    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
    const box = (await canvas.boundingBox())!
    // The test vessel lies across the middle of the view, rising to the right,
    // with its narrow part between these two spots (as fractions of the view).
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)

    await page.getByRole('button', { name: /^④/ }).click()
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

    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: /^④/ }).click()
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
    expect(await rootSize(page)).toBe('26px')
    await expect(page.getByRole('radio', { name: '大' })).toHaveAttribute('aria-checked', 'true')

    await page.reload()
    expect(await rootSize(page)).toBe('26px')

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

test.describe('language (言語), Aki 11/25', () => {
  test('English in the 3D analysis screens, remembered, and back to Japanese', async ({ page }) => {
    await useFakeAppwrite(page)
    await page.goto('/data')
    await expect(page.getByRole('heading', { name: '3D解析' })).toBeVisible()

    // The setting is in the user menu, next to 文字サイズ.
    await page.getByRole('button', { name: 'E2E Admin' }).click()
    await page.getByRole('radio', { name: 'English' }).click()
    await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('heading', { name: '3D Analysis' })).toBeVisible()
    await expect(page.getByPlaceholder('Search')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    // The folders' own names are the user's data: not translated.
    await expect(page.getByText('テスト用の学習 A')).toBeVisible()

    // The lesion screen too, including its hints and the new tab names.
    await page.goto('/data/3d-analysis')
    await page.getByLabel('Learning Name').fill('English study')
    await page.locator('input[type=file]').setInputFiles({
      name: 'vessel.stl',
      mimeType: 'application/octet-stream',
      buffer: makeStenosisStl(1, 3),
    })
    await page.waitForURL('**/data/lesion-measurement/analysis')
    await expect(page.getByText('3D stenosis shape preview')).toBeVisible()
    await expect(page.getByText('Please click to specify the two lesion positions.')).toBeVisible()
    await expect(page.getByText('Measurements and Shape', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^④/ })).toBeVisible()
    await expect(page.getByText('3D Viewer', { exact: true })).toBeVisible()

    // Remembered after a reload; back to 日本語 puts every text back.
    await page.goto('/data')
    await expect(page.getByRole('heading', { name: '3D Analysis' })).toBeVisible()
    await page.getByRole('button', { name: 'E2E Admin' }).click()
    await page.getByRole('radio', { name: '日本語' }).click()
    await expect(page.getByRole('heading', { name: '3D解析' })).toBeVisible()
    await expect(page.getByPlaceholder('検索')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  })
})

test.describe('the blood flow effect (Aki 11/25)', () => {
  test('light-blue flow runs along the measured vessel, and is not in the saved pictures', async ({ page }) => {
    const fake = await useFakeAppwrite(page)
    await uploadModel(page, '水流の学習')
    const canvas = page.locator('canvas').first()
    // The picture of the 3D canvas as a small copy, and how much two of them differ.
    const picture = () =>
      canvas.evaluate((el) => {
        const small = document.createElement('canvas')
        small.width = 96
        small.height = 96
        const context = small.getContext('2d')!
        context.drawImage(el as HTMLCanvasElement, 0, 0, 96, 96)
        return Array.from(context.getImageData(0, 0, 96, 96).data)
      })
    const difference = (x: number[], y: number[]) => x.reduce((sum, value, i) => sum + Math.abs(value - y[i]), 0) / x.length

    // Before the lesion is measured, once the model has faded in, the picture stands still.
    await page.waitForTimeout(3000)
    const still = await picture()
    await page.waitForTimeout(400)
    expect(difference(await picture(), still)).toBeLessThan(0.05)

    await measureLesion(page)
    // Measured, but the FFR is not calculated yet: still no flow (Aki 11/25).
    await page.waitForTimeout(1500)
    const beforeFfr = await picture()
    await page.waitForTimeout(400)
    expect(difference(await picture(), beforeFfr)).toBeLessThan(0.05)

    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(1500)

    // Once the FFR is measured, the flow moves: the picture is not the same a moment later.
    let moved = 0
    for (let i = 0; i < 4; i += 1) {
      const before = await picture()
      await page.waitForTimeout(300)
      moved = Math.max(moved, difference(await picture(), before))
    }
    expect(moved).toBeGreaterThan(0.2)

    // A saved picture is taken without the flow: the light-blue of the flow is on the live
    // view, and nowhere in the picture that is saved.
    const lightBlue = (dataUrl: string) =>
      page.evaluate(async (url) => {
        const image = new Image()
        image.src = url
        await image.decode()
        const c = document.createElement('canvas')
        c.width = image.width
        c.height = image.height
        const x = c.getContext('2d')!
        x.drawImage(image, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data
        let n = 0
        for (let k = 0; k < d.length; k += 4) {
          if (d[k + 1] > 195 && d[k + 2] > 235 && d[k] < 215 && d[k + 2] > d[k] + 25) n += 1
        }
        return n
      }, dataUrl)
    const live = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL('image/png'))
    const liveBlue = await lightBlue(live)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 })
    const saved = String(fake.rows('learning_content_frames')[0].image)
    const savedBlue = await lightBlue(saved)
    expect(liveBlue).toBeGreaterThan(300)
    expect(savedBlue).toBeLessThan(100)
  })
})

test.describe('the side menu (Aki 11/25)', () => {
  test('text only when expanded, icons only when collapsed, and it is remembered', async ({ page }) => {
    await useFakeAppwrite(page)
    await page.goto('/data')
    const aside = page.locator('aside')
    await expect(aside.getByText('3D解析', { exact: true })).toBeVisible()
    const open = (await aside.boundingBox())!.width
    expect(open).toBe(96)
    // Expanded: the words only, no icons in the items.
    await expect(aside.locator('nav a svg')).toHaveCount(0)

    await aside.getByRole('button', { name: 'メニューを折りたたむ' }).click()
    // Collapsed: icons only, narrower; the item keeps its name for screen readers and as a tooltip.
    await expect(aside.getByText('3D解析', { exact: true })).toHaveCount(0)
    await expect(aside.locator('nav a svg')).toHaveCount(1)
    await expect(aside.getByRole('link', { name: '3D解析' })).toHaveAttribute('title', '3D解析')
    await expect.poll(async () => (await aside.boundingBox())!.width).toBe(52)

    // Remembered after a reload, and 情報 still opens its two items (as icons).
    await page.reload()
    await expect(aside.getByRole('button', { name: 'メニューを開く' })).toBeVisible()
    await aside.getByRole('button', { name: '情報' }).click()
    await expect(aside.getByRole('link', { name: '学会' })).toBeVisible()
    await expect(aside.getByRole('link', { name: '資料' })).toBeVisible()

    await aside.getByRole('button', { name: 'メニューを開く' }).click()
    await expect(aside.getByText('3D解析', { exact: true })).toBeVisible()
  })
})

test.describe('the reset button (Aki 11/24)', () => {
  test('restores everything: the view (turn, position, zoom), the scissors, the lines, the depth', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'リセットの学習')
    const canvas = page.locator('canvas').first()
    // The picture the 3D canvas draws (not the buttons over it), as a small copy, once it
    // has stopped changing (the model fades in); two pictures are the same when they
    // differ by next to nothing.
    const picture = () =>
      canvas.evaluate((el) => {
        const small = document.createElement('canvas')
        small.width = 48
        small.height = 48
        const context = small.getContext('2d')!
        context.drawImage(el as HTMLCanvasElement, 0, 0, 48, 48)
        return Array.from(context.getImageData(0, 0, 48, 48).data)
      })
    const difference = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length
    const settled = async () => {
      let last = await picture()
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(200)
        const now = await picture()
        if (difference(now, last) < 0.05) return now
        last = now
      }
      return last
    }
    const start = await settled()

    // Zoom, turn, then align and slide the depth and the lines.
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '拡大', exact: true }).click()
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45, { steps: 8 })
    await page.mouse.up()
    await measureLesion(page)
    await page.getByTitle('整列して断面を表示').click()
    const slider = page.getByLabel('奥行き')
    await expect(slider).toBeVisible()
    await slider.fill('40')
    expect(difference(await settled(), start)).toBeGreaterThan(3)

    await page.getByTitle('リセットして選択をやり直す').click()

    // The scissors is off, nothing is aligned, the values are empty, the view is as it began.
    await expect(slider).toHaveCount(0)
    await expect(page.getByTitle('整列して断面を表示')).toHaveAttribute('aria-pressed', 'false')
    await expect(field(page, '病変近位径')).toHaveValue('')
    await expect(async () => {
      expect(difference(await settled(), start)).toBeLessThan(1)
    }).toPass({ timeout: 20_000 })
  })
})

test.describe('the user menu (Aki 11/24)', () => {
  test('opens over the page: no part of it is covered by the 3D view or its cards', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'メニューの学習')
    await page.locator('aside').getByRole('button', { name: /E2E Admin/ }).click()
    const menu = page.locator('aside .shadow-2xl')
    await expect(menu).toBeVisible()
    // The point at the middle of every item is the item itself, not something drawn over it.
    for (const name of ['ヘルプ', 'ユーザー管理', '文字サイズ', 'ログアウト']) {
      const covered = await menu.getByText(name, { exact: true }).first().evaluate((el) => {
        const box = el.getBoundingClientRect()
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return !top || !el.contains(top)
      })
      expect(covered, name).toBe(false)
    }
  })
})

test.describe('the saved list (解析結果一覧)', () => {
  test('a saved row shows the columns in the agreed order', async ({ page }) => {
    const fake = await useFakeAppwrite(page)
    await uploadModel(page, '解析結果一覧の学習')
    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: /^④/ }).click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 40_000 })
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()

    // The button and the list are called 保存 / 解析結果一覧 (no longer 仮保存).
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
    // The row's file name starts as the time it was saved.
    expect(saved[0].fileName).toMatch(/^[0-9]{8}_[0-9]{6}$/)
    // The picture is a JPEG: several times smaller than the PNG it used to be, and it is
    // carried in every row that every list loads.
    expect(String(saved[0].image)).toMatch(/^data:image\/jpeg;base64,/)
    await expect(page.getByRole('button', { name: '解析履歴に保存' })).toHaveCount(0)
    await expect(page.locator('tbody').getByTitle('保存済みキャプチャを開く')).toBeEnabled()
    // Table spacing (Aki 11/24): the picture column is as wide as the picture, and the value
    // columns (病変近位径 ... 病変位置) are all the same width, with no spare room.
    const widths = await page.locator('thead th').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))
    const image = (await page.locator('tbody img, tbody [role=img]').first().boundingBox()) ?? null
    if (image) expect(widths[0]).toBeLessThan(image.width + 24)
    // Aki 11/25: 編集 and 削除 are as wide as the other columns, and the table fills the
    // whole width, with no empty space on the right.
    const valueWidths = widths.slice(1)
    expect(valueWidths).toHaveLength(12)
    expect(Math.max(...valueWidths) - Math.min(...valueWidths)).toBeLessThan(1.5)
    const fill = await page.locator('table').last().evaluate((table) => {
      const scroller = table.parentElement!.getBoundingClientRect()
      return { gap: scroller.right - table.getBoundingClientRect().right, scrolls: table.parentElement!.scrollWidth > table.parentElement!.clientWidth }
    })
    if (!fill.scrolls) expect(Math.abs(fill.gap)).toBeLessThan(1.5)
    // The PDF download is an icon under the index tab (Aki 11/25), not a button above the table.
    const tabBox = (await page.getByText('解析結果一覧', { exact: true }).locator('xpath=..').boundingBox())!
    const iconBox = (await page.getByRole('button', { name: 'PDFダウンロード' }).boundingBox())!
    expect(iconBox.y).toBeGreaterThan(tabBox.y + tabBox.height - 1)
    expect(Math.abs(iconBox.x + iconBox.width / 2 - (tabBox.x + tabBox.width / 2))).toBeLessThan(6)
    expect(iconBox.width).toBeLessThan(40)
    // A wide list scrolls sideways.
    const scroller = page.locator('.pill-scrollbar').last()
    expect(await scroller.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto')
  })

  test('編集 brings back the lesion selection as it was when 保存 was clicked', async ({
    page,
  }) => {
    const fake = await useFakeAppwrite(page)
    await uploadModel(page, '編集で戻す学習')
    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: /^④/ }).click()
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
    // The name of the row that was opened is shown at the top left.
    await expect(page.getByTitle('編集中の保存データのファイル名')).toHaveText(String(row.fileName))
    await expect(page.locator('input[type=number]').first()).toHaveValue('100')
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /^④/ })).toBeVisible()
  })

  test('編集 on a row without saved ① ② opens the editable analysis, like a new one (Aki 11/25)', async ({
    page,
  }) => {
    const fake = await useFakeAppwrite(page)
    await uploadModel(page, '位置のない行の学習')
    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: /^④/ }).click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 40_000 })
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 20_000 })

    // An older row (or one saved by a database without the viewState column) has no ① ②.
    delete fake.rows('learning_content_frames')[0].viewState

    await page.getByTitle('リセットして選択をやり直す').click()
    await page.locator('tbody').getByTitle('保存済みキャプチャを開く').click()
    // Not a read-only saved capture: the same steps as a new analysis, the blood pressure of
    // the row is in, and a notice says that ① ② are to be chosen again.
    await expect(page.getByText(/①②の位置が残っていない/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('保存済みキャプチャ', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^① 近位径/ })).toBeEnabled()
    await expect(page.locator('input[type=number]').first()).toHaveValue('100')
    await expect(field(page, '病変近位径')).toHaveValue('')
    // And it can be edited on: the notice does not block the model, so ① can be chosen again.
    await expect
      .poll(async () => (await page.locator('canvas').first().boundingBox())?.width ?? 0)
      .toBeGreaterThan(500)
    await page.waitForTimeout(2500)
    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const again = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(again.x + again.width * 0.37, again.y + again.height * 0.575)
    await expect(page.getByRole('button', { name: /^② 遠位径/ })).toBeEnabled()
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

    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await page.getByRole('button', { name: /^④/ }).click()
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

test.describe('the global menu', () => {
  test('on the left: an admin sees 3D解析 and 情報, and the user menu', async ({ page }) => {
    await useFakeAppwrite(page)
    await page.goto('/documents')
    const sidebar = page.locator('aside')
    await expect(sidebar.getByRole('link', { name: '3D解析' })).toBeVisible()
    await sidebar.getByRole('button', { name: '情報', exact: true }).click()
    await expect(sidebar.getByRole('link', { name: '学会' })).toBeVisible()
    await sidebar.getByRole('link', { name: '学会' }).click()
    await expect(page).toHaveURL(/\/conference$/)

    await page.getByRole('button', { name: 'E2E Admin' }).click()
    for (const name of ['ヘルプ', 'ユーザー管理', 'ログアウト']) {
      await expect(page.getByText(name, { exact: true })).toBeVisible()
    }
    await expect(page.getByRole('radio')).toHaveCount(5)
  })

  test('a general user has no 3D解析, 情報 or ユーザー管理', async ({ page }) => {
    await useFakeAppwrite(page, { category: 'learning_user' })
    await page.goto('/help')
    const sidebar = page.locator('aside')
    await expect(sidebar.getByRole('button', { name: 'E2E Admin' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: '3D解析' })).toHaveCount(0)
    await expect(sidebar.getByRole('button', { name: '情報', exact: true })).toHaveCount(0)
    await sidebar.getByRole('button', { name: 'E2E Admin' }).click()
    await expect(page.getByRole('link', { name: 'ヘルプ' })).toBeVisible()
    await expect(page.getByText('ユーザー管理')).toHaveCount(0)
    await expect(page.getByRole('radio')).toHaveCount(5)
  })

  test('on a narrow window the top bar and its menu button are used', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await useFakeAppwrite(page)
    await page.goto('/documents')
    await expect(page.locator('aside')).toBeHidden()
    await expect(page.locator('header')).toBeVisible()
    await page.getByTitle('メニュー', { exact: true }).click()
    for (const name of ['3D解析', '学会', '資料', 'ヘルプ', 'ログアウト']) {
      await expect(page.locator('header').getByText(name, { exact: true })).toBeVisible()
    }
    await expect(page.locator('header').getByRole('radio')).toHaveCount(5)
  })
})

test.describe('scissors and the depth slider', () => {
  test('the cross-section opens, and the depth slider moves and resets', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '断面の学習')
    await measureLesion(page)
    await page.getByTitle('断面を表示').click()

    // The cross-section area is shown and the picture of the cut appears.
    await expect(page.getByText('断面積').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('横断面', { exact: true })).toBeVisible({ timeout: 20_000 })
    const slider = page.getByLabel('奥行き')
    await expect(slider).toBeVisible()
    await expect(slider).toHaveValue('0')
    // 手前 at the bottom, 奥 at the top: moving it up goes away from the viewer.
    await slider.fill('60')
    await expect(slider).toHaveValue('60')
    // A double click puts the model back where it was.
    await slider.dblclick()
    await expect(slider).toHaveValue('0')
    // The area shown is the same wherever the slider is (the cut does not change).
    await expect(page.getByText('断面積').first()).toBeVisible()
  })
})

test.describe('a fixed layout', () => {
  test('the blocks keep their size from the start, when the lesion is measured and when the cross-section opens', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '固定レイアウトの学習')
    // The cross-section area is on screen before anything is measured.
    await expect(page.getByText('横断面', { exact: true })).toBeVisible()

    // The block that holds the values and both previews, and the whole page.
    const block = page.locator('xpath=//*[normalize-space(text())="計測値・形状"]/ancestor::div[@data-block][1]/div[contains(@class,"rounded-2xl")]')
    const sizes = async () => {
      // Let every fade finish first.
      await page.waitForTimeout(900)
      return {
        block: (await block.boundingBox())!.height,
        page: await page.evaluate(() => document.documentElement.scrollHeight),
        viewer: (await page.locator('canvas').first().boundingBox())!.height,
      }
    }
    const before = await sizes()

    await measureLesion(page)
    const measured = await sizes()
    await page.getByTitle('断面を表示').click()
    await expect(page.getByText('断面積').first()).toBeVisible({ timeout: 20_000 })
    const sliced = await sizes()

    expect(measured).toEqual(before)
    expect(sliced).toEqual(before)
  })
})

test.describe('the FFR notice for a short narrowing', () => {
  test('a 狭窄長 under 1 mm is used as 1 mm, with a hint and a message', async ({ page }) => {
    await useFakeAppwrite(page)
    // A narrowing under 1 mm long, with the ends of the vessel in range.
    await uploadModel(page, '短い狭窄の学習', 1, 1.4)
    await measureLesion(page)
    const length = Number(await field(page, '狭窄長').inputValue())
    expect(length).toBeLessThan(1)

    // The amber hint under the field says which value is used for the calculation.
    await expect(page.getByText('FFRの計算には 1 mm を使用')).toBeVisible()
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    // The FFR is calculated, and a message says the 1 mm was used.
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/1 mm を使用しています/)).toBeVisible()
    // The value shown in the field does not change.
    expect(Number(await field(page, '狭窄長').inputValue())).toBe(length)
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

test.describe('hint texts worded by Aki (11/18)', () => {
  test('the hints in the lesion screen use the new wording', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '文言の学習')
    await expect(page.getByText('2点の病変位置をクリックして指定してください')).toBeVisible()
    await expect(page.getByText('病変指定箇所が表示されます')).toBeVisible()

    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
    await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
    await expect(page.getByText('調整が済んだら、「④ 計測」をクリックしてください')).toBeVisible()
    await expect(page.getByText('「③ 病変調整」から病変位置の詳細を調整できます')).toBeVisible()

    // The old wording is gone.
    await expect(page.getByText('はさみで切断すると表示されます')).toHaveCount(0)
    await expect(page.getByText('血管を輪切りにして断面積を確認できます')).toHaveCount(0)
  })
})

test.describe('the depth slider notice', () => {
  test('asks to adjust the slider, and the slider glows, when the section is outside the vessel', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '奥行きの学習')
    await measureLesion(page)
    await page.getByTitle('断面を表示').click()
    const slider = page.getByLabel('奥行き')
    await expect(slider).toBeVisible()
    await expect(page.getByText('横断面', { exact: true })).toBeVisible({ timeout: 20_000 })
    const notice = page.getByText('スライダーで奥行きを調整してください')

    // Slid all the way back, the section is beyond the far side of the vessel.
    await slider.fill('100')
    await expect(notice).toBeVisible()
    await expect(page.locator('[data-guided="true"]').filter({ has: slider })).toHaveCount(1)

    // Back at the surface the section is in the vessel again: no notice.
    await slider.fill('0')
    await expect(notice).toHaveCount(0)
  })

  test('the slider glows after every 測定範囲を更新, the hint only when the line is outside (Aki 11/19)', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '奥行きの点灯')
    await measureLesion(page)
    await page.getByTitle('断面を表示').click()
    const slider = page.getByLabel('奥行き')
    await expect(page.getByText('横断面', { exact: true })).toBeVisible({ timeout: 20_000 })
    const notice = page.getByText('スライダーで奥行きを調整してください')
    const glowing = page.locator('[data-guided="true"]').filter({ has: slider })

    // The line is inside the vessel: nothing glows yet.
    await slider.fill('10')
    await expect(notice).toHaveCount(0)
    await expect(glowing).toHaveCount(0)

    // Updating makes the slider glow, but there is no hint while the line is inside.
    await page.getByRole('button', { name: /^④/ }).dispatchEvent('click')
    await expect(glowing).toHaveCount(1)
    await expect(notice).toHaveCount(0)

    // Using the slider ends the glow; the next update starts it again.
    await slider.fill('12')
    await expect(glowing).toHaveCount(0)
    await page.getByRole('button', { name: /^④/ }).dispatchEvent('click')
    await expect(glowing).toHaveCount(1)
  })

  test('comes back right after 測定範囲を更新, even if it was closed before (Aki 11/19)', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '奥行きの再表示')
    await measureLesion(page)
    await page.getByTitle('断面を表示').click()
    const slider = page.getByLabel('奥行き')
    await expect(page.getByText('横断面', { exact: true })).toBeVisible({ timeout: 20_000 })
    const notice = page.getByText('スライダーで奥行きを調整してください')

    await slider.fill('100')
    await expect(notice).toBeVisible()
    await page.getByRole('status').filter({ has: notice }).getByLabel('ヒントを閉じる').click()
    await expect(notice).toHaveCount(0)

    // Updating the range asks for the slider again, and it glows.
    // (dispatchEvent: in a small test window a drag handle of the picture can lie over it.)
    await page.getByRole('button', { name: /^④/ }).dispatchEvent('click')
    await expect(notice).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-guided="true"]').filter({ has: slider })).toHaveCount(1)
  })
})

test.describe('font sizes in 計測値・形状 (Aki 11/18)', () => {
  test('two headings, two sub-headings and the words in the pictures at the size of the values', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '文字の大きさの学習')
    await measureLesion(page)
    await page.getByTitle('断面を表示').click()
    await expect(page.getByText('横断面', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('水平線').first()).toBeVisible()

    const sizes = await page.evaluate(() => {
      const css = (el: Element) => {
        const style = getComputedStyle(el)
        return { size: parseFloat(style.fontSize), color: style.color }
      }
      const byText = (text: string) =>
        [...document.querySelectorAll('p, span, label')].find((el) => el.textContent?.trim() === text)!
      // The size a word in an svg picture really shows at.
      const svgText = (text: string) => {
        const el = [...document.querySelectorAll('svg text')].find((t) => t.textContent?.trim().startsWith(text))!
        const svg = el.closest('svg')!
        const box = svg.viewBox.baseVal
        return parseFloat(el.getAttribute('font-size')!) * (svg.clientWidth / box.width)
      }
      return {
        measureHeading: css(byText('計測値')),
        previewHeading: css(byText('3D狭窄形状プレビュー')),
        lengthwise: css(byText('縦断面')),
        transverse: css(byText('横断面')),
        value: css(document.querySelector('[data-lesion-field] input')!),
        nearSide: css(byText('① 近位側')),
        smallest: css(byText('最小')),
        area: {
          ...css([...document.querySelectorAll('p')].find((el) => el.textContent?.startsWith('断面積'))!),
          weight: parseInt(
            getComputedStyle([...document.querySelectorAll('p')].find((el) => el.textContent?.startsWith('断面積'))!).fontWeight,
            10,
          ),
        },
        horizontalLine: svgText('水平線'),
        cutName: svgText('切断面'),
        front: svgText('手前'),
        depthLine: svgText('奥行き'),
      }
    })

    // Large: the two headings; a step smaller: 縦断面 and 横断面, in black too.
    expect(sizes.measureHeading.size).toBe(16)
    expect(sizes.previewHeading.size).toBe(16)
    expect(sizes.lengthwise.size).toBe(14)
    expect(sizes.transverse.size).toBe(14)
    for (const heading of [sizes.lengthwise, sizes.transverse]) {
      expect(heading.color).toBe(sizes.measureHeading.color)
    }
    // The values and the words in the pictures: one size.
    expect(sizes.value.size).toBe(12)
    for (const size of [sizes.nearSide.size, sizes.smallest.size, sizes.area.size]) expect(size).toBe(12)
    // 断面積 is regular text, not bold (Aki 11/19).
    expect(sizes.area.weight).toBe(400)
    for (const size of [sizes.horizontalLine, sizes.cutName, sizes.front, sizes.depthLine]) {
      expect(size).toBeGreaterThan(11.5)
      expect(size).toBeLessThan(12.5)
    }
  })
})

test.describe('correcting the lesion values', () => {
  test('is done in 計測値 only: no pencil over the 3D view, and the two diameters can be edited there', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, '修正の学習')
    await measureLesion(page)
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 20_000 })

    // The pencil that opened a second form with the same fields is gone.
    await expect(page.getByTitle('選択病変を修正')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // The same two values are editable in 計測値; the others are not.
    await expect(field(page, '病変近位径')).toBeEditable()
    await expect(field(page, '病変遠位径')).toBeEditable()
    await expect(field(page, '最小血管径')).not.toBeEditable()
    await expect(field(page, '狭窄率')).not.toBeEditable()
    const rate = await field(page, '狭窄率').inputValue()
    await field(page, '病変近位径').fill('4')
    await expect(field(page, '狭窄率')).not.toHaveValue(rate)
  })
})

test.describe('English does not overflow (Aki 11/26)', () => {
  for (const size of ['medium', 'large']) {
    test(`the user menu keeps every control inside its box, font size ${size}`, async ({ page }) => {
      await page.addInitScript(
        ([fontSize]) => {
          localStorage.setItem('language', 'en')
          localStorage.setItem('font-size', fontSize)
        },
        [size],
      )
      await useFakeAppwrite(page)
      await page.goto('/data')
      await page.locator('aside').getByRole('button').last().click()
      const menu = page.locator('aside .shadow-2xl')
      await expect(menu.getByText('Medium', { exact: true })).toBeVisible()
      const outside = await page.evaluate(() => {
        const box = document.querySelector('aside .shadow-2xl')!.getBoundingClientRect()
        return Array.from(document.querySelectorAll('aside .shadow-2xl *'))
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.right > box.right + 0.5 || r.left < box.left - 0.5
          })
          .map((el) => (el.textContent ?? '').trim())
      })
      expect(outside).toEqual([])
    })
  }

  test('the measured values stay inside their block at the large font size', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('language', 'en')
      localStorage.setItem('font-size', 'large')
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await useFakeAppwrite(page)
    // (The page is in English, so the name field is found by its type, not by its Japanese label.)
    await page.goto('/data/3d-analysis')
    await page.locator('input[type=text]').first().fill('overflow')
    await page.locator('input[type=file]').setInputFiles({
      name: 'vessel.stl',
      mimeType: 'application/octet-stream',
      buffer: makeStenosisStl(1, 3),
    })
    await page.waitForURL('**/data/lesion-measurement/analysis')
    await expect(page.getByText('Measurements', { exact: true })).toBeVisible()
    const inside = await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('p')).find((p) => p.textContent === 'Measurements')!
      const block = heading.closest('div.rounded-2xl')!.getBoundingClientRect()
      return Array.from(heading.parentElement!.querySelectorAll('input'))
        .map((input) => input.getBoundingClientRect())
        .every((r) => r.right <= block.right + 0.5 && r.left >= block.left - 0.5)
    })
    expect(inside).toBe(true)
  })
})

test.describe('long text does not break the layout (Aki 11/26)', () => {
  for (const language of ['ja', 'en']) {
    test(`the measured values stay in their own columns when the window is resized (${language}, Aki 11/26)`, async ({ page }) => {
      test.setTimeout(150_000)
      await page.addInitScript(([l]) => localStorage.setItem('language', l), [language])
      await page.setViewportSize({ width: 1600, height: 900 })
      await useFakeAppwrite(page)
      await page.goto('/data/3d-analysis')
      await page.locator('input[type=text]').first().fill('t')
      await page.locator('input[type=file]').setInputFiles({
        name: 'vessel.stl',
        mimeType: 'application/octet-stream',
        buffer: makeStenosisStl(1, 3),
      })
      await page.waitForURL('**/data/lesion-measurement/analysis')
      await page.waitForTimeout(3500)
      await page.getByRole('button', { name: /^① / }).click()
      const box = (await page.locator('canvas').first().boundingBox())!
      await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
      await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
      await page.getByRole('button', { name: /^④ / }).click()
      await page.locator('[data-lesion-field] input').first().waitFor()
      await expect(page.locator('[data-lesion-field] input').first()).not.toHaveValue('', { timeout: 60_000 })
      // The window made narrower and wider, as in Aki's video: no field runs into the next one.
      for (const width of [1920, 1440, 1280, 1180, 1100, 1024]) {
        await page.setViewportSize({ width, height: 800 })
        await page.waitForTimeout(400)
        const problems = await page.evaluate(() => {
          const fields = Array.from(document.querySelectorAll<HTMLElement>('[data-lesion-field]'))
          const found: string[] = []
          const rects = fields.map((field) => {
            let right = 0
            let left = Infinity
            for (const child of Array.from((field.firstElementChild as HTMLElement).querySelectorAll<HTMLElement>('*'))) {
              const r = child.getBoundingClientRect()
              if (r.width === 0) continue
              right = Math.max(right, r.right)
              left = Math.min(left, r.left)
            }
            return { key: field.dataset.lesionField!, box: field.getBoundingClientRect(), right, left }
          })
          for (const r of rects) if (r.right > r.box.right + 0.5) found.push(`${r.key} runs past its column`)
          for (const a of rects) {
            for (const b of rects) {
              if (a !== b && Math.abs(a.box.top - b.box.top) < 6 && a.box.left < b.box.left && a.right > b.left - 1) found.push(`${a.key} touches ${b.key}`)
            }
          }
          return found
        })
        expect(problems, `at ${width} px wide`).toEqual([])
      }
    })
  }

  test("a folder's list with a very long folder name does not grow wider than the screen", async ({ page }) => {
    const long = 'A_very_long_study_name_without_any_spaces_to_break_on_1234567890_abcdefghijklmnopqrstuvwxyz_and_more_and_more'
    await page.setViewportSize({ width: 1280, height: 800 })
    await useFakeAppwrite(page, {
      tables: {
        data_records: [{ $id: 'record-long', date: '2026/11/01', category: long, file: long + '.stl', owner: 'Owner', modelFileId: 'm1' }],
      },
    })
    await page.goto('/help')
    await page.waitForTimeout(800)
    await page.evaluate(() => {
      window.history.pushState({ usr: { dataRecordId: 'record-long' }, key: 'f', idx: (window.history.state?.idx ?? 0) + 1 }, '', '/data/learning-content')
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    await expect(page.getByRole('button', { name: '新規追加' })).toBeVisible()
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // The + and its hint stay on the screen.
    const plus = (await page.getByRole('button', { name: '新規追加' }).boundingBox())!
    expect(plus.x + plus.width).toBeLessThanOrEqual(1280)
    const hint = (await page.getByText('「+」でこのフォルダに新しいキャプチャを追加できます').boundingBox())!
    expect(hint.x + hint.width).toBeLessThanOrEqual(1280)
    expect(hint.x).toBeGreaterThanOrEqual((await page.locator('aside').boundingBox())!.width)
  })

  test("the hint of a folder's + is all on the screen, not under the menu, with a short folder name (Aki 11/26)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await useFakeAppwrite(page, {
      tables: {
        data_records: [{ $id: 'record-short', date: '2026/11/18', category: 'test1118', file: 'NC6_V1P2_KyosakuTest1_mm.stl', owner: 'Hospital admin', modelFileId: 'm1' }],
      },
    })
    await page.goto('/help')
    await page.waitForTimeout(800)
    await page.evaluate(() => {
      window.history.pushState({ usr: { dataRecordId: 'record-short' }, key: 'f', idx: (window.history.state?.idx ?? 0) + 1 }, '', '/data/learning-content')
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })
    const text = page.getByText('「+」でこのフォルダに新しいキャプチャを追加できます')
    await expect(text).toBeVisible()
    await page.waitForTimeout(500)
    const hint = (await text.boundingBox())!
    const menu = (await page.locator('aside').boundingBox())!
    // The whole text is to the right of the menu and inside the window.
    expect(hint.x).toBeGreaterThanOrEqual(menu.x + menu.width)
    expect(hint.x + hint.width).toBeLessThanOrEqual(1280)
  })

  for (const size of ['medium', 'large']) {
    test(`the results table in English: the headings do not run into each other, font size ${size}`, async ({ page }) => {
      await page.addInitScript(
        ([fontSize]) => {
          localStorage.setItem('language', 'en')
          localStorage.setItem('font-size', fontSize)
        },
        [size],
      )
      await page.setViewportSize({ width: 1440, height: 900 })
      const frame = (id: string) => ({
        $id: id,
        dataRecordId: 'record-a',
        image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        upstreamSize: '4.27 mm',
        downstreamSize: '4.43 mm',
        pa: '90 mmHg',
        pd: '71.8 mmHg',
        parameter: '18.2 mmHg',
        mld: '1.56 mm',
        mla: '1.91 mm²',
        stenosisRate: '64 %',
        segmentLength: '2.09 mm',
        lesionPosition: '中間',
      })
      await useFakeAppwrite(page, { tables: { learning_content_frames: [frame('a'), frame('b')] } })
      await page.goto('/help')
      await page.waitForTimeout(800)
      await page.evaluate(() => {
        window.history.pushState(
          {
            usr: {
              dataRecordId: 'record-a',
              viewFrame: {
                id: 'a',
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
      await expect(page.locator('tbody tr')).toHaveCount(2, { timeout: 20_000 })
      // Every heading's words are inside its own cell, and no heading touches the next one.
      const problems = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('thead th'))
        const boxes = cells.map((th) => {
          const range = document.createRange()
          range.selectNodeContents(th)
          return { text: (th.textContent ?? '').trim(), text_rect: range.getBoundingClientRect(), cell: th.getBoundingClientRect() }
        })
        const found: string[] = []
        for (const [i, b] of boxes.entries()) {
          if (b.text_rect.left < b.cell.left - 0.5 || b.text_rect.right > b.cell.right + 0.5) found.push('outside: ' + b.text)
          if (i > 0 && b.text_rect.left < boxes[i - 1].text_rect.right - 0.5 && b.text !== '') found.push('overlap: ' + boxes[i - 1].text + ' / ' + b.text)
        }
        return found
      })
      expect(problems).toEqual([])
    })
  }
})
