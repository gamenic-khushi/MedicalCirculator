import { ID, Query, type Models } from 'appwrite'

import { tablesDB } from './client'
import { appwriteConfig } from './config'

type RowInput<T extends Models.Row> = Omit<T, keyof Models.Row>

export const databaseService = {
  async list<T extends Models.Row = Models.DefaultRow>(tableId: string, queries?: string[]) {
    return tablesDB.listRows<T>({ databaseId: appwriteConfig.databaseId, tableId, queries })
  },

  // A plain list() returns only Appwrite's default page of 25 rows, so any
  // table that can outgrow that would silently hide its newest rows. This
  // walks every page, oldest first, and returns the rows in the same shape.
  async listAll<T extends Models.Row = Models.DefaultRow>(tableId: string, queries: string[] = []) {
    const pageSize = 100
    const rows: T[] = []
    let offset = 0
    while (true) {
      const page = await tablesDB.listRows<T>({
        databaseId: appwriteConfig.databaseId,
        tableId,
        queries: [...queries, Query.orderAsc('$createdAt'), Query.limit(pageSize), Query.offset(offset)],
      })
      rows.push(...page.rows)
      if (page.rows.length < pageSize) break
      offset += pageSize
    }
    return { rows, total: rows.length }
  },

  async get<T extends Models.Row = Models.DefaultRow>(tableId: string, rowId: string) {
    return tablesDB.getRow<T>({ databaseId: appwriteConfig.databaseId, tableId, rowId })
  },

  async create<T extends Models.Row = Models.DefaultRow>(
    tableId: string,
    data: RowInput<T>,
    rowId: string = ID.unique(),
  ): Promise<T> {
    const row = await tablesDB.createRow({
      databaseId: appwriteConfig.databaseId,
      tableId,
      rowId,
      data: data as Record<string, unknown>,
    })
    return row as unknown as T
  },

  async update<T extends Models.Row = Models.DefaultRow>(
    tableId: string,
    rowId: string,
    data: Partial<RowInput<T>>,
  ): Promise<T> {
    const row = await tablesDB.updateRow({
      databaseId: appwriteConfig.databaseId,
      tableId,
      rowId,
      data: data as Record<string, unknown>,
    })
    return row as unknown as T
  },

  async remove(tableId: string, rowId: string) {
    return tablesDB.deleteRow({ databaseId: appwriteConfig.databaseId, tableId, rowId })
  },
}
