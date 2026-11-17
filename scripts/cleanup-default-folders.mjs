#!/usr/bin/env node
// Deletes the folders named "２D心弁解析" (the default folder name) except the oldest
// one: for each other such folder, its saved results (rows of learning_content_frames
// linked to it), its stored 3D model file and the folder row itself.
//
// Requested by Aki on 2026/11/17: keep "the top of today's list (the oldest folder)",
// delete "the other ２D心弁解析 folders completely (the folder, its 3D model and its
// saved results)".
//
// THIS DELETES DATA FOR GOOD. It only lists what it would delete unless --yes is given.
//
// By default the oldest folder with that name is kept. To keep another one, give its
// id: --keep=<folder id>.
//
//   APPWRITE_ENDPOINT=https://app.sys4tr.com/v1 \
//   APPWRITE_PROJECT_ID=<project id> \
//   APPWRITE_DATABASE_ID=<database id> \
//   APPWRITE_BUCKET_ID=<the models bucket id> \
//   APPWRITE_API_KEY=<server API key> \
//   node scripts/cleanup-default-folders.mjs            # shows the plan, deletes nothing
//   node scripts/cleanup-default-folders.mjs --yes      # deletes
//
// The key needs: databases/tables rows read and delete, files read and delete. Create it
// in the Appwrite console, give it a short expiry, and delete it afterwards. The database
// and bucket ids are the VITE_APPWRITE_DATABASE_ID and VITE_APPWRITE_BUCKET_ID of the
// deployed site.
//
// Only a folder whose name is exactly the default name is touched (the full-width ２ is
// the one the app uses). Look at the plan first: the folder that is kept is printed.

const NAME = '２D心弁解析'
const args = process.argv.slice(2)
const YES = args.includes('--yes')
const KEEP_ID = args.find((arg) => arg.startsWith('--keep='))?.slice('--keep='.length)

const ENDPOINT = (process.env.APPWRITE_ENDPOINT ?? '').replace(/\/$/, '')
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID
const API_KEY = process.env.APPWRITE_API_KEY
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID
const BUCKET_ID = process.env.APPWRITE_BUCKET_ID

for (const [key, value] of Object.entries({
  APPWRITE_ENDPOINT: ENDPOINT,
  APPWRITE_PROJECT_ID: PROJECT_ID,
  APPWRITE_API_KEY: API_KEY,
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BUCKET_ID: BUCKET_ID,
})) {
  if (!value) {
    console.error(`Set ${key} (all five are needed; nothing has a default, on purpose).`)
    process.exit(1)
  }
}

async function api(method, path, query = []) {
  const url = new URL(`${ENDPOINT}${path}`)
  for (const q of query) url.searchParams.append('queries[]', JSON.stringify(q))
  const response = await fetch(url, {
    method,
    headers: { 'x-appwrite-project': PROJECT_ID, 'x-appwrite-key': API_KEY },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : undefined
  if (!response.ok) {
    const error = new Error(
      `${method} ${url.pathname} -> ${response.status} ${body?.message ?? ''}`,
    )
    error.status = response.status
    throw error
  }
  return body
}

async function listAll(tableId, filters = []) {
  const rows = []
  for (let offset = 0; ; offset += 100) {
    const page = await api('GET', `/tablesdb/${DATABASE_ID}/tables/${tableId}/rows`, [
      ...filters,
      { method: 'orderAsc', attribute: '$createdAt' },
      { method: 'limit', values: [100] },
      { method: 'offset', values: [offset] },
    ])
    rows.push(...page.rows)
    if (page.rows.length < 100) return rows
  }
}

const describe = (record) =>
  `${record.$id}  created ${record.$createdAt}  file ${record.file ?? '-'}  model ${record.modelFileId ?? '-'}`

async function main() {
  console.log(
    `${YES ? 'DELETING' : 'DRY RUN (nothing is deleted)'} on ${ENDPOINT}, project ${PROJECT_ID}\n`,
  )

  // The oldest first, as the app's list shows them.
  const records = await listAll('data_records')
  const named = records.filter((record) => record.category === NAME)
  console.log(`${records.length} folders in total, ${named.length} named "${NAME}".`)
  if (named.length === 0) return

  // The top of the app's list is the oldest folder of all, whatever it is called.
  console.log('\nThe first folders of the whole list (the oldest first, as the app shows them):')
  for (const record of records.slice(0, 5)) {
    const tag = record.category === NAME ? '[２D心弁解析]' : `[other name: ${record.category}]`
    console.log(`  ${tag}  ${describe(record)}`)
  }

  const keep = KEEP_ID ? named.find((record) => record.$id === KEEP_ID) : named[0]
  if (!keep) {
    console.error(`\n--keep=${KEEP_ID} is not one of the folders named "${NAME}". Nothing done.`)
    process.exit(1)
  }
  const victims = named.filter((record) => record.$id !== keep.$id)
  console.log(
    `\nKEPT (${KEEP_ID ? 'chosen with --keep' : 'the oldest with that name'}):\n  ${describe(keep)}`,
  )
  if (!KEEP_ID && keep.$id !== records[0].$id) {
    console.log(
      '\nNOTE: the folder at the very top of the whole list has another name. Make sure that "the model at the very top" Aki means is the one kept above (or choose with --keep=<id>).',
    )
  }
  if (victims.length === 0) {
    console.log('\nNo other folder with that name: nothing to delete.')
    return
  }

  const plan = []
  for (const record of victims) {
    const frames = await listAll('learning_content_frames', [
      { method: 'equal', attribute: 'dataRecordId', values: [record.$id] },
    ])
    plan.push({ record, frames })
  }
  console.log(`\nTO DELETE (${victims.length} folders):`)
  for (const { record, frames } of plan.slice(0, 15)) {
    console.log(
      `  ${describe(record)}\n    + ${frames.length} saved result(s)${record.modelFileId ? ' + its 3D model file' : ''}`,
    )
  }
  if (plan.length > 15) {
    console.log(`  ... and ${plan.length - 15} more folders (the totals below count all of them)`)
  }
  const frameTotal = plan.reduce((sum, item) => sum + item.frames.length, 0)
  const owners = {}
  for (const { record } of plan)
    owners[record.owner ?? '-'] = (owners[record.owner ?? '-'] ?? 0) + 1
  const ownerText = Object.entries(owners)
    .map(([name, count]) => `${name} ${count}`)
    .join(', ')
  console.log(`\nOwners of the folders to delete: ${ownerText}`)
  console.log(`\nTotal: ${victims.length} folders, ${frameTotal} saved results.`)

  if (!YES) {
    console.log('\nDry run: nothing was deleted. Check the list above, then run again with --yes.')
    return
  }

  for (const { record, frames } of plan) {
    for (const frame of frames) {
      await api(
        'DELETE',
        `/tablesdb/${DATABASE_ID}/tables/learning_content_frames/rows/${frame.$id}`,
      )
    }
    if (record.modelFileId) {
      try {
        await api('DELETE', `/storage/buckets/${BUCKET_ID}/files/${record.modelFileId}`)
      } catch (error) {
        // Already gone is fine; anything else is reported and stops the run.
        if (error.status !== 404) throw error
        console.log(`  (model file of ${record.$id} was already gone)`)
      }
    }
    await api('DELETE', `/tablesdb/${DATABASE_ID}/tables/data_records/rows/${record.$id}`)
    console.log(`  deleted ${record.$id}: ${frames.length} saved result(s), model, folder`)
  }
  console.log('\nDone.')
}

main().catch((error) => {
  console.error(`\nStopped: ${error.message}`)
  console.error(
    'Nothing further was deleted after this error; run the dry run again to see what is left.',
  )
  process.exit(1)
})
