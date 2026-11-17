import { Query, type Models } from 'appwrite'

import { databaseService } from '@/services/appwrite/database'

const TABLE = 'learning_content_frames'

// A saved capture keeps its picture in the row itself, as text, and that is by far
// the largest part of it (hundreds of KB). The lists show it only as a thumbnail, so
// they take every other column and let the pictures follow, as each row comes into
// view. (viewState is left out too: it is read when a row is opened.)
const LIST_COLUMNS = [
  'dataRecordId',
  'fileName',
  'upstreamSize',
  'downstreamSize',
  'pd',
  'pa',
  'parameter',
  'mld',
  'mla',
  'stenosisRate',
  'avgDiameter',
  'lumenVolume',
  'calcificationVolume',
  'bifurcationAngle',
  'segmentLength',
  'lesionPosition',
]

function isBadRequest(error: unknown) {
  return (error as { code?: number }).code === 400
}

// Runs a list of saved captures without their pictures. If the database refuses that
// (400), it is run again as before, with everything in every row: slower, never broken.
export async function loadWithoutPictures<T>(load: (queries: string[]) => Promise<T>): Promise<T> {
  try {
    return await load([Query.select(LIST_COLUMNS)])
  } catch (error) {
    if (!isBadRequest(error)) throw error
    console.error(error)
    return load([])
  }
}

type PictureRow = Models.Row & { image?: string }

async function fetchPicture(id: string): Promise<string> {
  try {
    const row = await databaseService.get<PictureRow>(TABLE, id, [Query.select(['image'])])
    return row.image ?? ''
  } catch (error) {
    if (!isBadRequest(error)) throw error
    const row = await databaseService.get<PictureRow>(TABLE, id)
    return row.image ?? ''
  }
}

// A few at a time, so a long list does not open a request per row at once, and each
// picture only once however many places ask for it.
const MAX_AT_ONCE = 3
const MAX_KEPT = 80
const pictures = new Map<string, Promise<string>>()
const waiting: (() => void)[] = []
let running = 0

function nextInLine() {
  if (running >= MAX_AT_ONCE) return
  waiting.shift()?.()
}

function inLine<T>(work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      running += 1
      work()
        .then(resolve, reject)
        .finally(() => {
          running -= 1
          nextInLine()
        })
    }
    if (running < MAX_AT_ONCE) start()
    else waiting.push(start)
  })
}

export function getFramePicture(id: string): Promise<string> {
  const known = pictures.get(id)
  if (known) return known
  const loading = inLine(() => fetchPicture(id))
  pictures.set(id, loading)
  loading.catch(() => pictures.delete(id))
  if (pictures.size > MAX_KEPT) {
    const oldest = pictures.keys().next().value
    if (oldest !== undefined) pictures.delete(oldest)
  }
  return loading
}
