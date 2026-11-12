import { toPng } from 'html-to-image'

/**
 * The 3D view (`view`, the box the 3D canvas and what is drawn over it share)
 * as a PNG, exactly as shown: with ① ②, the lines and their labels and the FFR
 * card, but not the view's buttons and panels (those tagged data-ffr-keep-clear).
 * A saved frame gets its own Pa/Pd panel and anatomy guide when opened again.
 */
export function captureViewAsShown(view: HTMLElement) {
  const canvas = view.querySelector('canvas')
  const ratio = canvas && canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : window.devicePixelRatio
  return toPng(view, {
    // As sharp as the 3D view itself, and the same size in pixels (the box can
    // be a fraction of a pixel off it).
    pixelRatio: ratio,
    ...(canvas && { canvasWidth: canvas.width / ratio, canvasHeight: canvas.height / ratio }),
    filter: (node) => !(node instanceof HTMLElement && node.dataset.ffrKeepClear !== undefined),
  })
}
