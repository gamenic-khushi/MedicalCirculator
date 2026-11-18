// The PDF report: a page of the browser's own (print to PDF) holding one section for each
// capture, each with its name, its picture and its values.

export interface ReportCapture {
  heading: string
  // A smaller line under the heading (when it was saved).
  note?: string
  image: string | null
  rows: [string, string][]
}

export interface Report {
  title: string
  subtitle?: string
  captures: ReportCapture[]
}

const STYLE = `
  body { font-family: sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subtitle { font-size: 12px; color: #666; margin: 0 0 20px; }
  section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #ddd; }
  h2 { font-size: 14px; margin: 0 0 2px; }
  .note { font-size: 11px; color: #666; margin: 0 0 8px; }
  img { display: block; max-width: 100%; max-height: 300px; object-fit: contain; margin-bottom: 12px; border-radius: 8px; background: #0b1220; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e5e5; }
  td:first-child { color: #666; width: 40%; }
`

function open(win: Window, title: string, body: string) {
  win.document.open()
  win.document.write(
    `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8" /><title></title><style>${STYLE}</style></head><body>${body}</body></html>`,
  )
  win.document.close()
  win.document.title = title
}

// Shown in the new window while the pictures are fetched, so it is not left blank.
export function showReportLoading(win: Window, title: string, message: string) {
  open(win, title, '<p class="subtitle" id="loading"></p>')
  const loading = win.document.getElementById('loading')
  if (loading) loading.textContent = message
}

// Writes the report into the window and prints it once its pictures are in (not
// before: a picture that is not there yet would print as a blank).
export function writeReport(win: Window, report: Report) {
  open(win, report.title, '')
  const doc = win.document
  const body = doc.body
  const add = <K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tag: K,
    text?: string,
    className?: string,
  ) => {
    const element = doc.createElement(tag)
    if (text !== undefined) element.textContent = text
    if (className) element.className = className
    parent.appendChild(element)
    return element
  }

  add(body, 'h1', report.title)
  if (report.subtitle) add(body, 'p', report.subtitle, 'subtitle')

  const images: HTMLImageElement[] = []
  for (const capture of report.captures) {
    const section = add(body, 'section')
    add(section, 'h2', capture.heading)
    if (capture.note) add(section, 'p', capture.note, 'note')
    if (capture.image) {
      const img = add(section, 'img')
      img.alt = 'モデル画像'
      images.push(img)
    }
    const table = add(section, 'table', undefined, 'values')
    for (const [label, value] of capture.rows) {
      const row = add(table, 'tr')
      add(row, 'td', label)
      add(row, 'td', value)
    }
  }

  let waiting = images.length
  let printed = false
  const print = () => {
    if (printed) return
    printed = true
    win.focus()
    win.print()
  }
  const oneDone = () => {
    waiting -= 1
    if (waiting <= 0) print()
  }
  report.captures
    .filter((capture) => capture.image)
    .forEach((capture, index) => {
      images[index].onload = oneDone
      images[index].onerror = oneDone
      images[index].src = capture.image as string
    })
  if (images.length === 0) print()
}
