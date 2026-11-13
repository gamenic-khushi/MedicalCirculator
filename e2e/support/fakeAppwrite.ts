import type { Page, Route } from '@playwright/test'

// An in-memory stand-in for Appwrite, so the end-to-end tests never reach a real
// server and need no password. The tests are built with a fake endpoint
// (http://appwrite.test/v1, see .env.e2e); this answers every request to it, and
// anything else that leaves localhost is refused.

export type Row = Record<string, unknown> & { $id: string }

export interface FakeAppwrite {
  /** The rows currently held for a table (what the app has saved). */
  rows(tableId: string): Row[]
  /** Every request the app made to the fake, as "METHOD /path". */
  requests: string[]
}

export interface FakeAppwriteOptions {
  /** Start signed in (default) or signed out (the account call answers 401). */
  signedIn?: boolean
  /** The signed-in user's category; the admin pages need an admin one. */
  category?: 'system_admin' | 'hospital_admin' | 'hospital_user' | 'learning_admin' | 'learning_user'
  /** Rows to start with, by table. */
  tables?: Record<string, Row[]>
}

const ACCOUNT = {
  $id: 'user-e2e',
  $createdAt: '2026-01-01T00:00:00.000+00:00',
  $updatedAt: '2026-01-01T00:00:00.000+00:00',
  name: 'E2E Admin',
  email: 'e2e-admin@example.test',
  emailVerification: true,
  status: true,
  prefs: {},
  labels: [],
}

function stamp(): string {
  return new Date().toISOString().replace('Z', '+00:00')
}

let counter = 0
function nextId(): string {
  counter += 1
  return `e2e-id-${counter}`
}

function parseQueries(url: URL): { method: string; attribute?: string; values?: unknown[] }[] {
  const queries: { method: string; attribute?: string; values?: unknown[] }[] = []
  for (const [key, value] of url.searchParams) {
    if (!key.startsWith('queries')) continue
    try {
      queries.push(JSON.parse(value))
    } catch {
      // Ignore a query we cannot read.
    }
  }
  return queries
}

export async function useFakeAppwrite(
  page: Page,
  options: FakeAppwriteOptions = {},
): Promise<FakeAppwrite> {
  const signedIn = options.signedIn ?? true
  const category = options.category ?? 'system_admin'
  const tables = new Map<string, Row[]>()
  const seed: Record<string, Row[]> = {
    users: [
      {
        $id: 'user-row-e2e',
        accountId: ACCOUNT.$id,
        email: ACCOUNT.email,
        name: ACCOUNT.name,
        category,
      },
    ],
    data_records: [
      {
        $id: 'record-a',
        date: '2026/11/01',
        category: 'テスト用の学習 A',
        file: 'sample-a.stl',
        owner: 'E2E Admin',
      },
      {
        $id: 'record-b',
        date: '2026/11/02',
        category: 'テスト用の学習 B',
        file: 'sample-b.stl',
        owner: 'E2E Admin',
      },
    ],
    ...options.tables,
  }
  for (const [tableId, rows] of Object.entries(seed)) {
    tables.set(
      tableId,
      rows.map((row) => ({ $createdAt: stamp(), $updatedAt: stamp(), $permissions: [], ...row })),
    )
  }
  const requests: string[] = []

  // Nothing may leave the machine: only the app itself and the fake are allowed.
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url())
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'appwrite.test') {
      return route.fallback()
    }
    return route.abort()
  })

  await page.route('http://appwrite.test/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const origin = request.headers()['origin'] ?? 'http://localhost:4173'
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? '*',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-expose-headers': '*',
    }
    const send = (status: number, body?: unknown) =>
      route.fulfill({
        status,
        headers: { ...cors, 'content-type': 'application/json' },
        body: body === undefined ? '' : JSON.stringify(body),
      })

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    requests.push(`${request.method()} ${url.pathname}`)

    const path = url.pathname.replace(/^\/v1/, '')
    return handle(route, request.method(), path, url, send)
  })

  function handle(
    route: Route,
    method: string,
    path: string,
    url: URL,
    send: (status: number, body?: unknown) => Promise<void>,
  ): Promise<void> {
    const request = route.request()

    // Account
    if (path === '/account' && method === 'GET') {
      return signedIn ? send(200, ACCOUNT) : send(401, { message: 'Unauthorized', code: 401 })
    }
    if (path === '/account/sessions/email' && method === 'POST') {
      return send(201, { $id: 'session-e2e', userId: ACCOUNT.$id, expire: '2099-01-01T00:00:00.000+00:00' })
    }
    if (path.startsWith('/account/sessions') && method === 'DELETE') return send(204)

    // Rows: /tablesdb/{db}/tables/{table}/rows[/{id}]
    const rowsMatch = path.match(/^\/tablesdb\/[^/]+\/tables\/([^/]+)\/rows(?:\/([^/]+))?$/)
    if (rowsMatch) {
      const [, tableId, rowId] = rowsMatch
      const rows = tables.get(tableId) ?? []
      tables.set(tableId, rows)
      const meta = { $databaseId: 'e2e-database', $tableId: tableId }

      if (method === 'GET' && !rowId) {
        let found = rows.slice()
        let limit = 25
        let offset = 0
        for (const query of parseQueries(url)) {
          const values = query.values ?? []
          if (query.method === 'equal' && query.attribute) {
            found = found.filter((row) => values.includes(row[query.attribute as string]))
          } else if (query.method === 'limit') limit = Number(values[0])
          else if (query.method === 'offset') offset = Number(values[0])
        }
        return send(200, { total: found.length, rows: found.slice(offset, offset + limit).map((r) => ({ ...r, ...meta })) })
      }
      if (method === 'GET' && rowId) {
        const row = rows.find((r) => r.$id === rowId)
        return row ? send(200, { ...row, ...meta }) : send(404, { message: 'Row not found', code: 404 })
      }
      if (method === 'POST') {
        const body = JSON.parse(request.postData() ?? '{}') as { rowId?: string; data?: Record<string, unknown> }
        const row: Row = {
          $id: body.rowId && body.rowId !== 'unique()' ? body.rowId : nextId(),
          $createdAt: stamp(),
          $updatedAt: stamp(),
          $permissions: [],
          ...body.data,
        }
        rows.push(row)
        return send(201, { ...row, ...meta })
      }
      if (method === 'PATCH' && rowId) {
        const body = JSON.parse(request.postData() ?? '{}') as { data?: Record<string, unknown> }
        const row = rows.find((r) => r.$id === rowId)
        if (!row) return send(404, { message: 'Row not found', code: 404 })
        Object.assign(row, body.data, { $updatedAt: stamp() })
        return send(200, { ...row, ...meta })
      }
      if (method === 'DELETE' && rowId) {
        tables.set(
          tableId,
          rows.filter((r) => r.$id !== rowId),
        )
        return send(204)
      }
    }

    // Storage: an upload is answered with a file record; the bytes are not kept.
    const filesMatch = path.match(/^\/storage\/buckets\/([^/]+)\/files(?:\/([^/]+))?/)
    if (filesMatch) {
      const [, bucketId, fileId] = filesMatch
      if (method === 'POST') {
        const body = request.postDataBuffer()?.toString('latin1') ?? ''
        const sent = body.match(/name="fileId"\r\n\r\n([^\r]+)/)?.[1]
        return send(201, {
          $id: sent && sent !== 'unique()' ? sent : nextId(),
          bucketId,
          $createdAt: stamp(),
          $updatedAt: stamp(),
          $permissions: [],
          name: 'upload',
          signature: '',
          mimeType: 'application/octet-stream',
          sizeOriginal: 0,
          chunksTotal: 1,
          chunksUploaded: 1,
        })
      }
      if (method === 'DELETE') return send(204)
      if (method === 'GET' && fileId) return send(404, { message: 'File not stored by the fake', code: 404 })
    }

    return send(404, { message: `The fake Appwrite does not know ${method} ${path}`, code: 404 })
  }

  return {
    rows: (tableId) => tables.get(tableId) ?? [],
    requests,
  }
}
