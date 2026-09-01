const CROP_FRACTION = 0.45

export async function createAnnotatedSnapshot(
  imageDataUrl: string,
  point: { x: number; y: number } | null,
): Promise<string> {
  if (!point) return imageDataUrl

  const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageDataUrl
  })

  const originalX = (point.x / 100) * imageElement.width
  const originalY = (point.y / 100) * imageElement.height

  const cropWidth = Math.min(imageElement.width * CROP_FRACTION, imageElement.width)
  const cropHeight = Math.min(imageElement.height * CROP_FRACTION, imageElement.height)
  const cropX = Math.min(Math.max(originalX - cropWidth / 2, 0), imageElement.width - cropWidth)
  const cropY = Math.min(Math.max(originalY - cropHeight / 2, 0), imageElement.height - cropHeight)

  const canvas = document.createElement('canvas')
  canvas.width = cropWidth
  canvas.height = cropHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return imageDataUrl

  ctx.drawImage(imageElement, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
  return canvas.toDataURL('image/png')
}
