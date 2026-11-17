#!/usr/bin/env node
// Creates the Appwrite database, tables, columns, indexes and storage buckets that
// Medical Circulator needs, in a NEW (empty) Appwrite project, for example a fresh
// development project after the old one was deleted or paused.
//
//   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 \
//   APPWRITE_PROJECT_ID=<project id> \
//   APPWRITE_API_KEY=<server API key> \
//   node scripts/setup-appwrite-schema.mjs [--dry-run] [--database <id>]
//
// Optionally also create the first admin so you can log in (give the password
// yourself; it is never printed and never stored in this repository):
//
//   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... SEED_ADMIN_NAME="Your Name" \
//   node scripts/setup-appwrite-schema.mjs
//
// The API key needs these scopes: databases.read/write, tables.read/write,
// columns.read/write, indexes.read/write, rows.read/write, buckets.read/write,
// users.read/write (the last two only for what you use).
//
// It can be run again safely: whatever already exists is left as it is.
//
// What it does NOT do (do these once in the Appwrite console):
//   * Add a Web platform for the host the app runs on (for example `localhost`),
//     otherwise the browser is refused with a CORS / "invalid origin" error.
//   * The function `resolveProximityTiebreak` (deploy it with `appwrite push functions`).
//
// The tables and columns below are what the code reads and writes (see
// src/services/appwrite/*.ts and the pages that call databaseService). When a page
// starts to use a new column, add it here too.
//
// It refuses to run against the deployed self-hosted server (app.sys4tr.com):
// that project already has its schema, and changing it is done by hand.

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const argValue = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const ENDPOINT = (process.env.APPWRITE_ENDPOINT ?? 'https://cloud.appwrite.io/v1').replace(
  /\/$/,
  '',
)
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID
const API_KEY = process.env.APPWRITE_API_KEY
const DATABASE_ID = argValue('--database', process.env.APPWRITE_DATABASE_ID ?? 'medical_circulator')
const MODELS_BUCKET_ID = process.env.APPWRITE_BUCKET_ID ?? 'model_files'
const DOCUMENTS_BUCKET_ID = process.env.APPWRITE_DOCUMENTS_BUCKET_ID ?? 'document_files'

// Everyone who is logged in may read and write, as the app expects (the admin-only
// parts are decided in the app by the user's category, not by Appwrite).
const TABLE_PERMISSIONS = ['read("users")', 'create("users")', 'update("users")', 'delete("users")']
// Pictures and models are loaded by plain <img> tags and by fetches from another
// origin, which do not carry the login cookie, so reading is open to everyone;
// only logged-in users may add, change or delete files.
const BUCKET_PERMISSIONS = ['read("any")', 'create("users")', 'update("users")', 'delete("users")']

const USER_CATEGORIES = [
  'system_admin',
  'hospital_admin',
  'hospital_user',
  'learning_admin',
  'learning_user',
]

const s = (key, size, required = false) => ({ kind: 'string', key, size, required })
const SHORT = 255
const LONG = 2048

const TABLES = [
  {
    id: 'users',
    name: 'Users',
    columns: [
      s('date', 32, true),
      { kind: 'enum', key: 'category', elements: USER_CATEGORIES, required: true },
      s('organization', SHORT, true),
      s('name', SHORT, true),
      s('email', 320),
      s('accountId', 64),
    ],
    indexes: [
      { key: 'idx_accountId', columns: ['accountId'] },
      { key: 'idx_email', columns: ['email'] },
    ],
  },
  {
    id: 'data_records',
    name: 'Data records',
    columns: [
      s('date', 32, true),
      s('category', SHORT, true),
      s('file', SHORT, true),
      s('owner', SHORT, true),
      s('modelFileId', 64),
    ],
    indexes: [],
  },
  {
    id: 'learning_content_frames',
    name: 'Learning content frames',
    columns: [
      s('dataRecordId', 64),
      // The picture of the view as a data URL, so a very long text.
      { kind: 'longtext', key: 'image', required: true },
      s('fileName', SHORT),
      s('upstreamSize', 64, true),
      s('downstreamSize', 64, true),
      s('pd', 64, true),
      s('pa', 64, true),
      s('parameter', 64, true),
      s('mld', 64),
      s('mla', 64),
      s('stenosisRate', 64),
      s('avgDiameter', 64),
      s('lumenVolume', 64),
      s('calcificationVolume', 64),
      s('bifurcationAngle', 64),
      s('segmentLength', 64),
      s('lesionPosition', 64),
      // JSON: what the view looked like at 保存 (① ②, camera, blood pressure), for 編集.
      s('viewState', 4096),
    ],
    indexes: [{ key: 'idx_dataRecordId', columns: ['dataRecordId'] }],
  },
  {
    id: 'conference_papers',
    name: 'Conference papers',
    columns: [
      s('date', 32, true),
      s('journal', LONG, true),
      s('title', LONG, true),
      s('url', LONG),
    ],
    indexes: [],
  },
  {
    id: 'documents',
    name: 'Documents',
    columns: [
      s('date', 32, true),
      s('fileName', 512, true),
      s('folder', SHORT),
      s('imageUrl', LONG),
    ],
    indexes: [],
  },
  {
    id: 'document_folders',
    name: 'Document folders',
    columns: [s('name', SHORT, true)],
    indexes: [],
  },
  {
    // The start page (通知): system updates and the activity log.
    id: 'notifications',
    name: 'Notifications',
    columns: [
      s('title', LONG, true),
      s('description', 4096, true),
      s('date', 32, true),
      s('time', 32, true),
      { kind: 'enum', key: 'priority', elements: ['high', 'normal', 'low'], required: true },
    ],
    indexes: [],
  },
  {
    // Only the old formula-settings code uses it (the page was removed), kept so
    // that code still works against a new project.
    id: 'formula_settings',
    name: 'Formula settings',
    columns: [{ kind: 'float', key: 'ffrStenosisFactor', required: false }],
    indexes: [],
  },
]

const BUCKETS = [
  {
    id: MODELS_BUCKET_ID,
    name: 'Models',
    maximumFileSize: 200 * 1024 * 1024,
    allowedFileExtensions: ['fbx', 'stl', 'obj'],
  },
  {
    id: DOCUMENTS_BUCKET_ID,
    name: 'Documents',
    maximumFileSize: 20 * 1024 * 1024,
    allowedFileExtensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  },
]

// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`\n${message}`)
  process.exit(1)
}

if (/sys4tr\.com/i.test(ENDPOINT)) {
  fail(
    `Refusing to run against ${ENDPOINT}: that is the deployed server, whose schema is changed by hand.`,
  )
}
if (!DRY_RUN && (!PROJECT_ID || !API_KEY)) {
  fail(
    'Set APPWRITE_PROJECT_ID and APPWRITE_API_KEY (or use --dry-run to only list what would be made).',
  )
}

class ApiError extends Error {
  constructor(status, body, method, path) {
    super(`${method} ${path} -> ${status} ${body?.type ?? ''} ${body?.message ?? ''}`.trim())
    this.status = status
    this.body = body
  }
}

async function api(method, path, body) {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-appwrite-project': PROJECT_ID,
      'x-appwrite-key': API_KEY,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let parsed
  try {
    parsed = text ? JSON.parse(text) : undefined
  } catch {
    parsed = { message: text }
  }
  if (!response.ok) throw new ApiError(response.status, parsed, method, path)
  return parsed
}

// Runs a create call; "already exists" (409) is fine and reported as such.
async function ensure(label, create) {
  if (DRY_RUN) {
    console.log(`  [dry run] ${label}`)
    return 'dry-run'
  }
  try {
    await create()
    console.log(`  created   ${label}`)
    return 'created'
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      console.log(`  exists    ${label}`)
      return 'exists'
    }
    throw error
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function createColumn(tableId, column) {
  const base = `/tablesdb/${DATABASE_ID}/tables/${tableId}/columns`
  const common = { key: column.key, required: column.required }
  switch (column.kind) {
    case 'string':
      return api('POST', `${base}/string`, { ...common, size: column.size })
    case 'enum':
      return api('POST', `${base}/enum`, { ...common, elements: column.elements })
    case 'float':
      return api('POST', `${base}/float`, common)
    case 'longtext': {
      // Newer servers have a dedicated very-long-text column; older ones only a
      // string column with a large size. Try them from the best fit downwards.
      const attempts = [
        () => api('POST', `${base}/longtext`, common),
        () => api('POST', `${base}/mediumtext`, common),
        () => api('POST', `${base}/string`, { ...common, size: 1073741823 }),
        () => api('POST', `${base}/string`, { ...common, size: 16777215 }),
      ]
      let last
      for (const attempt of attempts) {
        try {
          return await attempt()
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) throw error
          last = error
        }
      }
      throw last
    }
    default:
      throw new Error(`Unknown column kind ${column.kind}`)
  }
}

async function waitForColumns(tableId, keys) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const { columns } = await api('GET', `/tablesdb/${DATABASE_ID}/tables/${tableId}/columns`)
    const wanted = columns.filter((column) => keys.includes(column.key))
    const failed = wanted.find((column) => column.status === 'failed')
    if (failed) throw new Error(`Column ${tableId}.${failed.key} failed: ${failed.error ?? ''}`)
    if (wanted.length === keys.length && wanted.every((column) => column.status === 'available'))
      return
    await sleep(1500)
  }
  throw new Error(`Timed out waiting for the columns of ${tableId} to become available.`)
}

async function main() {
  console.log(`${DRY_RUN ? 'DRY RUN - nothing is changed.\n' : ''}Endpoint: ${ENDPOINT}`)
  console.log(`Project:  ${PROJECT_ID ?? '(not set)'}\nDatabase: ${DATABASE_ID}\n`)

  console.log('Database')
  await ensure(`database ${DATABASE_ID}`, () =>
    api('POST', '/tablesdb', { databaseId: DATABASE_ID, name: 'Medical Circulator' }),
  )

  for (const table of TABLES) {
    console.log(`\nTable ${table.id}`)
    await ensure(`table ${table.id}`, () =>
      api('POST', `/tablesdb/${DATABASE_ID}/tables`, {
        tableId: table.id,
        name: table.name,
        permissions: TABLE_PERMISSIONS,
        rowSecurity: false,
        enabled: true,
      }),
    )
    // A table close to the row-size limit refuses even a column that already exists
    // (column_limit_exceeded, not "already exists"), so the existing ones are skipped.
    const existing = DRY_RUN
      ? []
      : (await api('GET', `/tablesdb/${DATABASE_ID}/tables/${table.id}/columns`)).columns.map(
          (column) => column.key,
        )
    for (const column of table.columns) {
      const type = column.kind === 'string' ? `string(${column.size})` : column.kind
      if (existing.includes(column.key)) {
        console.log(`  exists    column ${table.id}.${column.key} ${type}`)
        continue
      }
      await ensure(
        `column ${table.id}.${column.key} ${type}${column.required ? ' required' : ''}`,
        () => createColumn(table.id, column),
      )
    }
    if (!DRY_RUN && table.indexes.length > 0) {
      await waitForColumns(
        table.id,
        table.columns.map((column) => column.key),
      )
    }
    for (const index of table.indexes) {
      await ensure(`index ${table.id}.${index.key} on ${index.columns.join(', ')}`, () =>
        api('POST', `/tablesdb/${DATABASE_ID}/tables/${table.id}/indexes`, {
          key: index.key,
          type: 'key',
          columns: index.columns,
        }),
      )
    }
  }

  console.log('\nStorage buckets')
  for (const bucket of BUCKETS) {
    await ensure(`bucket ${bucket.id} (${bucket.allowedFileExtensions.join(', ')})`, async () => {
      // A server caps the file size (Appwrite Cloud's free plan at 50 MB, a default
      // self-hosted one at 30 MB). If it refuses the size, retry with the maximum
      // its error message names.
      let maximumFileSize = bucket.maximumFileSize
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await api('POST', '/storage/buckets', {
            bucketId: bucket.id,
            name: bucket.name,
            permissions: BUCKET_PERMISSIONS,
            fileSecurity: false,
            enabled: true,
            maximumFileSize,
            allowedFileExtensions: bucket.allowedFileExtensions,
          })
        } catch (error) {
          const limit = Number(
            String(error.body?.message ?? '')
              .match(/between 1 and ([0-9,]+)/)?.[1]
              ?.replace(/,/g, ''),
          )
          if (
            !(error instanceof ApiError) ||
            error.status !== 400 ||
            !limit ||
            limit >= maximumFileSize
          )
            throw error
          console.log(
            `  (server allows at most ${Math.round(limit / 1024 / 1024)} MB per file, using that)`,
          )
          maximumFileSize = limit
        }
      }
    })
  }

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (email && password) {
    console.log('\nFirst admin')
    const name = process.env.SEED_ADMIN_NAME ?? 'Administrator'
    const created = DRY_RUN
      ? undefined
      : await api('POST', '/users', { userId: 'unique()', email, password, name }).catch(
          async (error) => {
            if (error instanceof ApiError && error.status === 409) {
              const list = await api(
                'GET',
                `/users?queries[0]=${encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'email', values: [email] }))}`,
              )
              return list.users[0]
            }
            throw error
          },
        )
    console.log(`  ${DRY_RUN ? '[dry run] ' : ''}login account for ${email}`)
    const today = new Date()
    const date = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`
    await ensure(`users row (system_admin) for ${email}`, () =>
      api('POST', `/tablesdb/${DATABASE_ID}/tables/users/rows`, {
        rowId: 'unique()',
        data: {
          date,
          category: 'system_admin',
          organization: 'Development',
          name,
          email,
          accountId: created.$id,
        },
      }),
    )
  } else {
    console.log(
      '\n(No first admin made: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to make one.)',
    )
  }

  console.log(`
Done. Put these in .env (the project ID and endpoint are not secret):

  VITE_APPWRITE_ENDPOINT=${ENDPOINT}
  VITE_APPWRITE_PROJECT_ID=${PROJECT_ID ?? '<project id>'}
  VITE_APPWRITE_DATABASE_ID=${DATABASE_ID}
  VITE_APPWRITE_BUCKET_ID=${MODELS_BUCKET_ID}
  VITE_APPWRITE_DOCUMENTS_BUCKET_ID=${DOCUMENTS_BUCKET_ID}

Still to do by hand in the Appwrite console: add a Web platform for the host the
app runs on (for example localhost).`)
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
