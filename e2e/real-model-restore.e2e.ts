import { existsSync, readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

import { useFakeAppwrite } from './support/fakeAppwrite'

// 保存, then 編集 from the folder's list, on a REAL coronary model (the way a user works), checking that
// ① ② come back as they were (Aki 11/27: "the lesion selection state is not restored"). The
// folder's stored model is served back from the same file, as the live storage does.
// Skipped on a computer without the model file.
const FILE = process.env.REAL_STL ?? 'D:/Company work/resized_test_files_mm/NC6_V1P2_KyosakuTest1_mm.stl'

function field(page: Page, label: string) {
  return page.locator(`xpath=//span[normalize-space(.)="${label}"]/ancestor::div[@data-lesion-field][1]//input`)
}

test.describe('編集 brings back ① ② on a real model', () => {
  test.skip(!existsSync(FILE), 'the real model file is not on this computer')

  test('保存, then 編集 from the folder list, restores the selection', async ({ page }) => {
    test.setTimeout(300_000)
    page.setDefaultTimeout(90_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const fake = await useFakeAppwrite(page)
    await page.route('**/files/*/view*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/octet-stream', body: readFileSync(FILE) }),
    )
    await page.goto('/data/3d-analysis')
    await page.getByLabel('学習名').fill('実モデルの復元')
    await page.locator('input[type=file]').setInputFiles(FILE)
    await page.waitForURL('**/data/lesion-measurement/analysis')
    await expect(page.getByText('3D狭窄形状プレビュー')).toBeVisible()
    await page.waitForTimeout(4000)

    // ① ② placed by clicking on the vessel, as a user does.
    await page.getByTitle('病変の始点（心臓に近い側）を選択').click()
    await page.mouse.click(688, 418)
    await page.mouse.click(712, 452)
    await page.getByRole('button', { name: /^④/ }).click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 120_000 })
    const measured = await field(page, '最小断面積').inputValue()
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 })

    const row = fake.rows('learning_content_frames')[0]
    // 保存 kept ① ② with the row (a database without the viewState column would save it without).
    expect(JSON.parse(String(row.viewState)).annotations).toHaveLength(2)
    const folderId = String(row.dataRecordId)

    // The folder's list, then 編集 on the row.
    await page.evaluate((id) => {
      window.history.pushState(
        { usr: { dataRecordId: id }, key: 'folder-real', idx: (window.history.state?.idx ?? 0) + 1 },
        '',
        '/data/learning-content',
      )
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, folderId)
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 })
    await page.waitForTimeout(1500)
    await page.locator('tbody').getByTitle('編集').click()
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 150_000 })
    await expect(field(page, '最小断面積')).toHaveValue(measured, { timeout: 60_000 })
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 60_000 })
    // ① and ② are back on the vessel (their markers are on the screen).
    await expect(page.getByRole('button', { name: /^④/ })).toBeVisible()
  })
})
