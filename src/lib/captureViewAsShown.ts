import { toJpeg } from 'html-to-image'

// A 3D render has no transparent parts, so a JPEG at this quality looks the same and is
// several times smaller than the PNG it used to be. Every saved capture carries its
// picture in its row, and every list and report loads it, so its size is felt everywhere.
const JPEG_QUALITY = 0.9

/**
 * The 3D view (`view`, the box the 3D canvas and what is drawn over it share)
 * as a JPEG, exactly as shown: with ① ②, the lines and their labels and the FFR
 * card, but not the view's buttons and panels (those tagged data-ffr-keep-clear).
 * A saved frame gets its own Pa/Pd panel and anatomy guide when opened again.
 */
export function captureViewAsShown(view: HTMLElement) {
  const canvas = view.querySelector('canvas')
  const ratio = canvas && canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : window.devicePixelRatio
  return toJpeg(view, {
    quality: JPEG_QUALITY,
    // A JPEG has no transparency: what is not covered is the view's own background.
    backgroundColor: getComputedStyle(view).backgroundColor || '#000000',
    // As sharp as the 3D view itself, and the same size in pixels (the box can
    // be a fraction of a pixel off it).
    pixelRatio: ratio,
    ...(canvas && { canvasWidth: canvas.width / ratio, canvasHeight: canvas.height / ratio }),
    filter: (node) => !(node instanceof HTMLElement && node.dataset.ffrKeepClear !== undefined),
  })
}
