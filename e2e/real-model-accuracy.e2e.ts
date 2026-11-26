import { existsSync, readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

import { computeFfrCubic } from '../src/lib/ffrCubicModel'
import { useFakeAppwrite } from './support/fakeAppwrite'

// The same measurement through the screen on a REAL coronary model (210,822 triangles, mm). The
// lesion is a severe narrowing of one vessel. ① and ② are two points on its surface, 5 mm before and
// 4.4 mm after the narrowest cut; they were found and measured directly (without the screen) by
// src/lib/realModelAccuracy.test.ts, which also worked the areas out again on its own from the
// triangles:
//   direct measurement: 病変近位径 4.572, 病変遠位径 4.778, 最小断面積 1.9143 (independent: 1.9141),
//   最小血管径 1.561, 狭窄長 2.10.
// The screen is opened the way 編集 on a saved row opens it (① ② and the blood pressure given), so
// the points are exactly these, and the screen measures them and calculates the FFR itself.
// Skipped on a computer without the model file.
const FILE = process.env.REAL_STL ?? 'D:/Company work/resized_test_files_mm/NC6_V1P2_KyosakuTest1_mm.stl'
const P1: [number, number, number] = [191.495, 1002.702, -10.037]
const P2: [number, number, number] = [198.167, 1005.033, -16.892]

// The app puts a loaded STL in its own frame: the middle of its bounding box moved to the origin, then
// turned by -90 degrees about X (the file's Z up becomes Y up): (x, y, z) -> (x - cx, z - cz, -(y - cy)).
function inAppFrame(points: [number, number, number][]): [number, number, number][] {
  const bytes = readFileSync(FILE)
  const count = bytes.readUInt32LE(80)
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < count; i++) {
    for (let v = 0; v < 3; v++) {
      for (let k = 0; k < 3; k++) {
        const x = bytes.readFloatLE(84 + i * 50 + 12 + v * 12 + k * 4)
        if (x < low[k]) low[k] = x
        if (x > high[k]) high[k] = x
      }
    }
  }
  const [cx, cy, cz] = low.map((l, k) => (l + high[k]) / 2)
  return points.map(([x, y, z]) => [x - cx, z - cz, -(y - cy)])
}

function field(page: Page, label: string) {
  return page.locator(`xpath=//span[normalize-space(.)="${label}"]/ancestor::div[@data-lesion-field][1]//input`)
}

test.describe('numerical accuracy on a real model, through the screen', () => {
  test.skip(!existsSync(FILE), 'the real model file is not on this computer')

  test('the screen shows the directly measured values, and its FFR follows the formula', async ({ page }) => {
    test.setTimeout(240_000)
    page.setDefaultTimeout(90_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await useFakeAppwrite(page)
    await page.goto('/data/3d-analysis')
    await page.getByLabel('学習名').fill('実モデルの精度')
    await page.locator('input[type=file]').setInputFiles(FILE)
    await page.waitForURL('**/data/lesion-measurement/analysis')
    await expect(page.getByText('3D狭窄形状プレビュー')).toBeVisible()
    await page.waitForTimeout(4000)

    // Opened the way 編集 opens a saved row: the same page again, with the two points and the pressure.
    await page.evaluate(
      ([p1, p2]) => {
        const state = window.history.state ?? {}
        window.history.pushState(
          {
            ...state,
            usr: {
              ...(state.usr ?? {}),
              bloodPressure: '100',
              restoreFfr: true,
              cameraState: null,
              annotations: [
                { id: 'real-1', x: 50, y: 50, worldPoint: p1 },
                { id: 'real-2', x: 50, y: 50, worldPoint: p2 },
              ],
            },
            key: 'real-model',
            idx: (state.idx ?? 0) + 1,
          },
          '',
          '/data/lesion-measurement/analysis',
        )
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
      },
      inAppFrame([P1, P2]),
    )
    await expect(field(page, '病変近位径')).not.toHaveValue('', { timeout: 120_000 })
    await expect(page.getByText(/FFR-\s*0\.\d+/)).toBeVisible({ timeout: 90_000 })

    const read = async (label: string) => Number(await field(page, label).inputValue())
    const shown = {
      dp: await read('病変近位径'),
      dd: await read('病変遠位径'),
      minD: await read('最小血管径'),
      minA: await read('最小断面積'),
      length: await read('狭窄長'),
      rate: await read('狭窄率'),
    }
    const ffr = Number((await page.getByText(/FFR-\s*0\.\d+/).innerText()).match(/0\.\d+/)![0])
    const formula = computeFfrCubic({ dp: shown.dp, dd: shown.dd, a: shown.minA, l: shown.length, p: 100 })
    console.log('REAL SCREEN ' + JSON.stringify({ shown, ffr, formula: +formula.toFixed(4) }))

    // The screen shows what the direct measurement gave (to the decimals it shows).
    expect(Math.abs(shown.dp - 4.572)).toBeLessThan(0.02)
    expect(Math.abs(shown.dd - 4.778)).toBeLessThan(0.02)
    expect(Math.abs(shown.minA - 1.9143) / 1.9143).toBeLessThan(0.01)
    expect(Math.abs(shown.minD - 1.561)).toBeLessThan(0.02)
    expect(Math.abs(shown.length - 2.1)).toBeLessThan(0.1)
    // 狭窄率 from the displayed diameters.
    expect(Math.abs(shown.rate - 100 * (1 - shown.minD / ((shown.dp + shown.dd) / 2)))).toBeLessThan(1)
    // FFR on the screen is the formula's value for the displayed inputs, to its two decimals.
    expect(Math.abs(ffr - formula)).toBeLessThan(0.0051)

    // For the record: the picture of the real vessel with the flow along it.
    const canvas = page.locator('canvas').first()
    await page.waitForTimeout(1500)
    await canvas.screenshot({ path: 'fluid-trial/real-model-screen.png' })
  })
})
