import { expect, test, type Page } from '@playwright/test'

import { useFakeAppwrite } from './support/fakeAppwrite'
import { makeStenosisStl } from './support/stenosisModel'

// The value box of a row in the 選択病変 panel, found by the row's label.
function field(page: Page, label: string) {
  return page.locator(
    `xpath=//span[normalize-space(.)="${label}"]/ancestor::div[contains(@class,"justify-between")][1]//input`,
  )
}

async function uploadModel(page: Page, studyName: string) {
  await page.goto('/data/3d-analysis')
  await page.getByLabel('学習名').fill(studyName)
  await page.locator('input[type=file]').setInputFiles({
    name: 'vessel.stl',
    mimeType: 'application/octet-stream',
    buffer: makeStenosisStl(),
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
  test('the 狭窄長 cannot be edited, the diameters can', async ({ page }) => {
    await useFakeAppwrite(page)
    await uploadModel(page, 'E2Eの学習')
    await expect(field(page, '狭窄長')).toHaveJSProperty('readOnly', true)
    await expect(field(page, '最小断面積')).toHaveJSProperty('readOnly', true)
    await expect(field(page, '病変近位径')).toHaveJSProperty('readOnly', false)
    await expect(field(page, '病変遠位径')).toHaveJSProperty('readOnly', false)
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

test.describe('help page', () => {
  test('describes the current screens', async ({ page }) => {
    await useFakeAppwrite(page)
    await page.goto('/help')
    const text = await page.locator('main').innerText()
    expect(text).toContain('3D狭窄形状プレビュー')
    expect(text).toContain('格子')
    // Texts that were removed from the app must not come back.
    expect(text).not.toContain('宇宙')
    expect(text).not.toContain('生成される3D狭窄形状')
  })
})
