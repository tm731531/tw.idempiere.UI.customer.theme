import { apiFetch } from '../../shared/api/http'
import type { TabField, FieldColumn } from '../window/api'
import { ReferenceType } from '../window/api'

const API_V1 = '/api/v1'

export async function getRequestTabFields(
  token: string,
  language?: string,
): Promise<TabField[]> {
  // Try to fetch AD_Table for R_Request to derive fields dynamically
  let tableId: number | null = null
  try {
    const tableRes = await apiFetch<{ records: any[] }>(`${API_V1}/models/AD_Table`, {
      token,
      searchParams: {
        $filter: `TableName eq 'R_Request'`,
        $select: 'AD_Table_ID,TableName',
      },
    })
    if (tableRes.records && tableRes.records.length > 0 && typeof tableRes.records[0].AD_Table_ID === 'number') {
      tableId = tableRes.records[0].AD_Table_ID
    } else {
      // Fallback if not found
      console.warn('R_Request AD_Table_ID not found in response, using fallback fields')
      return getBasicRequestFields()
    }
  } catch {
    // Fallback on error
    console.warn('Error fetching AD_Table for R_Request, using fallback fields')
    return getBasicRequestFields()
  }

  // If we have a tableId, fetch the columns for that table
  if (tableId != null) {
    try {
      const cols = await apiFetch<{ records: any[] }>(`${API_V1}/models/AD_Column`, {
        token,
        searchParams: {
          $filter: `AD_Table_ID eq ${tableId} and IsActive eq true`,
          $select: 'AD_Column_ID,ColumnName,Name,Description,Help,FieldLength,IsMandatory,IsKey,IsParent,AD_Reference_ID,AD_Reference_Value_ID',
          $orderby: 'ColumnSQL, IsIdentifier desc'
        }
      })
      const fields: TabField[] = []
      let seq = 10
      for (const c of cols.records ?? []) {
        if (!c?.ColumnName) continue
        fields.push({
          id: c.AD_Column_ID ?? (100000 + seq),
          uid: `field_${c.ColumnName}`,
          name: c.Name || c.ColumnName,
          description: c.Description,
          help: c.Help,
          columnId: c.AD_Column_ID,
          columnName: c.ColumnName,
          seqNo: seq,
          isDisplayed: true,
          column: {
            id: c.AD_Column_ID,
            columnName: c.ColumnName,
            fieldLength: c.FieldLength,
            isMandatory: c.IsMandatory ?? false,
            isKey: c.IsKey ?? false,
            isParent: c.IsParent ?? false,
            referenceId: c.AD_Reference_ID,
            referenceValueId: c.AD_Reference_Value_ID
          } as FieldColumn
        } as TabField)
        seq += 10
      }
      return fields.length ? fields : getBasicRequestFields()
    } catch {
      // fallback
    }
  }

  // Fallback to basic fields if dynamic load not available
  return getBasicRequestFields()
}

export function getBasicRequestFields(): TabField[] {
  const f1: TabField = {
    id: -1,
    uid: 'field_customer',
    name: '客戶',
    description: '選擇客戶',
    help: '選擇與此諮詢相關的客戶',
    columnId: -1,
    columnName: 'C_BPartner_ID',
    seqNo: 10,
    isDisplayed: true,
    column: {
      id: -1,
      columnName: 'C_BPartner_ID',
      fieldLength: 10,
      isMandatory: true,
      isKey: false,
      isParent: false,
      referenceId: ReferenceType.TableDirect,
      referenceValueId: 138
    } as FieldColumn
  }

  const f2: TabField = {
    id: -2,
    uid: 'field_summary',
    name: '諮詢單名稱',
    description: '諮詢需求的簡要說明',
    help: '輸入諮詢的簡要標題',
    columnId: -2,
    columnName: 'Summary',
    seqNo: 20,
    isDisplayed: true,
    column: {
      id: -2,
      columnName: 'Summary',
      fieldLength: 255,
      isMandatory: true,
      isKey: false,
      isParent: false,
      referenceId: ReferenceType.String
    } as FieldColumn
  }

  const f3: TabField = {
    id: -3,
    uid: 'field_result',
    name: '說明',
    description: '詳細的需求說明',
    help: '需求說明',
    columnId: -3,
    columnName: 'Result',
    seqNo: 30,
    isDisplayed: true,
    column: {
      id: -3,
      columnName: 'Result',
      fieldLength: 2000,
      isMandatory: false,
      isKey: false,
      isParent: false,
      referenceId: ReferenceType.Text
    } as FieldColumn
  }

  const f4: TabField = {
    id: -4,
    uid: 'field_start',
    name: '諮詢開始',
    description: '開始時間',
    help: '開始時間',
    columnId: -4,
    columnName: 'StartDate',
    seqNo: 40,
    isDisplayed: true,
    column: {
      id: -4,
      columnName: 'StartDate',
      fieldLength: 0,
      isMandatory: false,
      isKey: false,
      isParent: false,
      referenceId: ReferenceType.DateTime
    } as FieldColumn
  }

  const f5: TabField = {
    id: -5,
    uid: 'field_end',
    name: '諮詢結束',
    description: '結束時間',
    help: '結束時間',
    columnId: -5,
    columnName: 'CloseDate',
    seqNo: 50,
    isDisplayed: true,
    column: {
      id: -5,
      columnName: 'CloseDate',
      fieldLength: 0,
      isMandatory: false,
      isKey: false,
      isParent: false,
      referenceId: ReferenceType.DateTime
    } as FieldColumn
  }

  return [f1, f2, f3, f4, f5]
}
