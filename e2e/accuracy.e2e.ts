import { expect, test, type Page } from '@playwright/test'

import { computeFfrCubic } from '../src/lib/ffrCubicModel'
import { useFakeAppwrite } from './support/fakeAppwrite'
import { makeStenosisStl } from './support/stenosisModel'

// Numerical accuracy through the screen, with a vessel whose true dimensions are known exactly
// (see src/lib/measurementAccuracy.test.ts for how they are worked out): a tube 30 mm long, 5 mm
// wide, narrowing to 1.6 mm in the middle. The mesh's true narrowest cut is 1.988 mm² (a 24-sided
// ring of radius 0.8 mm), an equivalent diameter of 1.591 mm, and the stenosis length is 2.006 mm.
const TRUE_MIN_AREA = 1.988
const TRUE_MIN_DIAMETER = 1.591
const TRUE_STENOSIS_LENGTH = 2.006

function field(page: Page, label: string) {
  return page.locator(`xpath=//span[normalize-space(.)="${label}"]/ancestor::div[@data-lesion-field][1]//input`)
}

async function measure(page: Page, unit: number, fakeAlreadyOn = false) {
  if (!fakeAlreadyOn) await useFakeAppwrite(page)
  await page.goto('/data/3d-analysis')
  await page.getByLabel('学習名').fill('精度の学習')
  await page.locator('input[type=file]').setInputFiles({
    name: 'vessel.stl',
    mimeType: 'application/octet-stream',
    buffer: makeStenosisStl(unit, 3),
  })
  await page.waitForURL('**/data/lesion-measurement/analysis')
  await expect
    .poll(async () => (await page.locator('canvas').first().boundingBox())?.width ?? 0)
    .toBeGreaterThan(500)
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: /^① 近位径/ }).click()
  const box = (await page.locator('canvas').first().boundingBox())!
  await page.mouse.click(box.x + box.width * 0.37, box.y + box.height * 0.575)
  await page.mouse.click(box.x + box.width * 0.63, box.y + box.height * 0.445)
  await page.getByRole('button', { name: /^④ 計測/ }).click()
  await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 60_000 })
  const read = async (label: string) => Number(await field(page, label).inputValue())
  return {
    dp: await read('病変近位径'),
    dd: await read('病変遠位径'),
    minD: await read('最小血管径'),
    minA: await read('最小断面積'),
    length: await read('狭窄長'),
    rate: await read('狭窄率'),
  }
}

test.describe('numerical accuracy on a vessel of known dimensions', () => {
  test('the measured values agree with the true ones, and FFR and Pd follow from them', async ({ page }) => {
    test.setTimeout(150_000)
    const m = await measure(page, 1)
    console.log('ACCURACY (screen, mm model)', JSON.stringify(m))

    // The narrowest cut, the stenosis length: against the true values.
    expect(Math.abs(m.minD - TRUE_MIN_DIAMETER)).toBeLessThan(0.05)
    expect(Math.abs(m.minA - TRUE_MIN_AREA) / TRUE_MIN_AREA).toBeLessThan(0.04)
    expect(Math.abs(m.length - TRUE_STENOSIS_LENGTH)).toBeLessThan(0.3)
    // The reference diameters are those of the tube at the two clicked points (the tube is at most
    // 5 mm wide, and about 4.9 to 5.0 there).
    expect(m.dp).toBeGreaterThan(4.8)
    expect(m.dp).toBeLessThanOrEqual(5.0)
    expect(m.dd).toBeGreaterThan(4.8)
    expect(m.dd).toBeLessThanOrEqual(5.0)
    // 狭窄率 is 1 - (minimum diameter / mean of the two reference diameters), in percent.
    expect(Math.abs(m.rate - 100 * (1 - m.minD / ((m.dp + m.dd) / 2)))).toBeLessThan(1)
    // And against the true value for this tube (about 68%).
    expect(Math.abs(m.rate - 100 * (1 - TRUE_MIN_DIAMETER / 4.955))).toBeLessThan(1.5)

    // FFR for 100 mmHg: the displayed value is the formula's value for the displayed inputs.
    await page.locator('input[type=number]').first().fill('100')
    await page.getByRole('button', { name: 'FFRを計算' }).click()
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 40_000 })
    const shown = Number((await page.getByText(/FFR-\s*0\.\d+/).innerText()).match(/0\.\d+/)![0])
    const expected = computeFfrCubic({ dp: m.dp, dd: m.dd, a: m.minA, l: m.length, p: 100 })
    console.log('ACCURACY (FFR)', JSON.stringify({ shown, expected: +expected.toFixed(4) }))
    expect(Math.abs(shown - expected)).toBeLessThan(0.0051) // shown with two decimals
    // Pd = Pa x FFR, to the 0.1 mmHg it is shown with.
    const pd = Number((await page.getByText(/^Pd$/).locator('xpath=following-sibling::*[1]').innerText()).replace(/[^0-9.]/g, ''))
    expect(Math.abs(pd - 100 * expected)).toBeLessThan(0.06)
  })

  test('a model written in metres gives the same numbers as one written in mm', async ({ page }) => {
    test.setTimeout(240_000)
    const inMm = await measure(page, 1)
    const inMetres = await measure(page, 1000, true)
    console.log('ACCURACY (metres vs mm)', JSON.stringify({ inMm, inMetres }))
    for (const key of ['dp', 'dd', 'minD', 'minA', 'length', 'rate'] as const) {
      const scale = Math.max(Math.abs(inMm[key]), 1)
      expect(Math.abs(inMetres[key] - inMm[key]) / scale).toBeLessThan(0.02)
    }
  })

  test('the FFR on screen follows the blood pressure the way the formula does', async ({ page }) => {
    test.setTimeout(240_000)
    const m = await measure(page, 1)
    const results: Record<number, { shown: number; expected: number }> = {}
    for (const pressure of [80, 100, 120]) {
      await page.locator('input[type=number]').first().fill(String(pressure))
      await page.getByRole('button', { name: 'FFRを計算' }).click()
      await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 40_000 })
      await page.waitForTimeout(600)
      const shown = Number((await page.getByText(/FFR-\s*0\.\d+/).innerText()).match(/0\.\d+/)![0])
      const expected = computeFfrCubic({ dp: m.dp, dd: m.dd, a: m.minA, l: m.length, p: pressure })
      results[pressure] = { shown, expected: +expected.toFixed(4) }
      expect(Math.abs(shown - expected)).toBeLessThan(0.0051)
    }
    console.log('ACCURACY (pressures)', JSON.stringify(results))
  })
})
