import { apiFetch } from '../../shared/api/http'
import { batchGetSysConfig, getSysConfig, setSysConfig } from './utils'

const API_V1 = '/api/v1'

type SearchParams = Record<string, string | number | boolean | undefined>

export interface Resource {
  id: number
  name: string
  resourceTypeId: number
}

export interface ResourceType {
  id: number
  name: string
  isTimeSlot: boolean
  isDateSlot: boolean
  timeSlotStart?: string
  timeSlotEnd?: string
  onMonday?: boolean
  onTuesday?: boolean
  onWednesday?: boolean
  onThursday?: boolean
  onFriday?: boolean
  onSaturday?: boolean
  onSunday?: boolean
}

export interface ResourceAssignment {
  id: number
  name: string
  from: string
  to?: string
}

export async function listResources(token: string): Promise<Resource[]> {
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/S_Resource`,
    {
      token,
      searchParams: {
        $select: 'S_Resource_ID,Name,S_ResourceType_ID',
        $orderby: 'Name',
      } satisfies SearchParams,
    },
  )

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
    resourceTypeId: Number(r.S_ResourceType_ID?.id ?? r.S_ResourceType_ID ?? 0),
  }))
}

export async function getResourceType(token: string, id: number): Promise<ResourceType> {
  const r = await apiFetch<any>(`${API_V1}/models/S_ResourceType/${id}`, {
    token,
    searchParams: {
      $select:
        'S_ResourceType_ID,Name,IsTimeSlot,IsDateSlot,TimeSlotStart,TimeSlotEnd,OnMonday,OnTuesday,OnWednesday,OnThursday,OnFriday,OnSaturday,OnSunday',
    } satisfies SearchParams,
  })
  return {
    id: Number(r.S_ResourceType_ID),
    name: String(r.Name ?? ''),
    isTimeSlot: r.IsTimeSlot === true || r.IsTimeSlot === 'Y',
    isDateSlot: r.IsDateSlot === true || r.IsDateSlot === 'Y',
    timeSlotStart: r.TimeSlotStart ? String(r.TimeSlotStart) : undefined,
    timeSlotEnd: r.TimeSlotEnd ? String(r.TimeSlotEnd) : undefined,
    onMonday: r.OnMonday === true || r.OnMonday === 'Y',
    onTuesday: r.OnTuesday === true || r.OnTuesday === 'Y',
    onWednesday: r.OnWednesday === true || r.OnWednesday === 'Y',
    onThursday: r.OnThursday === true || r.OnThursday === 'Y',
    onFriday: r.OnFriday === true || r.OnFriday === 'Y',
    onSaturday: r.OnSaturday === true || r.OnSaturday === 'Y',
    onSunday: r.OnSunday === true || r.OnSunday === 'Y',
  }
}

export function formatTimestampForFilter(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  // Local timestamp in JDBC-ish format (server parses)
  const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `'${s}'`
}

export async function listAssignmentsForRange(
  token: string,
  resourceId: number,
  start: Date,
  end: Date,
): Promise<ResourceAssignment[]> {
  const filter = `S_Resource_ID eq ${resourceId} and AssignDateFrom ge ${formatTimestampForFilter(start)} and AssignDateFrom lt ${formatTimestampForFilter(end)}`
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/S_ResourceAssignment`,
    {
      token,
      searchParams: {
        $select: 'S_ResourceAssignment_ID,Name,AssignDateFrom,AssignDateTo',
        $orderby: 'AssignDateFrom',
        $filter: filter,
      } satisfies SearchParams,
    },
  )
  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
    from: String(r.AssignDateFrom),
    to: r.AssignDateTo ? String(r.AssignDateTo) : undefined,
  }))
}

export async function createAssignment(
  token: string,
  input: {
    resourceId: number
    name: string
    from: Date
    to: Date
    qty?: number
    description?: string
  },
): Promise<any> {
  // API requires ISO format: yyyy-MM-dd'T'HH:mm:ss'Z'
  const toISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const json: Record<string, any> = {
    S_Resource_ID: input.resourceId,
    Name: input.name,
    AssignDateFrom: toISO(input.from),
    AssignDateTo: toISO(input.to),
    Qty: input.qty ?? 1,
    IsConfirmed: false,
  }

  if (input.description !== undefined) {
    json.Description = input.description
  }

  return await apiFetch<any>(`${API_V1}/models/S_ResourceAssignment`, {
    method: 'POST',
    token,
    json,
  })
}

export async function updateAssignment(
  token: string,
  id: number,
  input: {
    name?: string
    from?: Date
    to?: Date
    description?: string
  },
): Promise<any> {
  const toISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const json: Record<string, any> = {}
  if (input.name !== undefined)
    json.Name = input.name
  if (input.from !== undefined)
    json.AssignDateFrom = toISO(input.from)
  if (input.to !== undefined)
    json.AssignDateTo = toISO(input.to)
  if (input.description !== undefined)
    json.Description = input.description

  return await apiFetch<any>(`${API_V1}/models/S_ResourceAssignment/${id}`, {
    method: 'PUT',
    token,
    json,
  })
}

export async function deleteAssignment(token: string, id: number): Promise<void> {
  await apiFetch<any>(`${API_V1}/models/S_ResourceAssignment/${id}`, {
    method: 'DELETE',
    token,
  })
}

/**
 * Get color label configuration for a resource assignment
 * @param token - Auth token
 * @param assignmentId - Resource assignment ID
 * @returns Color hex string or null if not configured
 */
export async function getAssignmentColor(token: string, assignmentId: number): Promise<string | null> {
  try {
    const configName = `EMUI_RESOURCE_ASSIGNMENT_COLOR_${assignmentId}`
    const config = await getSysConfig(token, configName)
    return config?.value || null
  }
  catch (error) {
    console.error(`Failed to get assignment color for ${assignmentId}:`, error)
    return null
  }
}

/**
 * Set color label for a resource assignment
 * @param token - Auth token
 * @param assignmentId - Resource assignment ID
 * @param color - Color hex string (e.g., '#3b82f6')
 * @returns true if successful
 */
export async function setAssignmentColor(
  token: string,
  assignmentId: number,
  color: string,
): Promise<boolean> {
  try {
    const configName = `EMUI_RESOURCE_ASSIGNMENT_COLOR_${assignmentId}`
    await setSysConfig(
      token,
      configName,
      color,
      `Color label for resource assignment ${assignmentId}`,
      'S',
    )
    return true
  }
  catch (error) {
    console.error(`Failed to set assignment color for ${assignmentId}:`, error)
    return false
  }
}

/**
 * Batch get color labels for multiple assignments
 * @param token - Auth token
 * @param assignmentIds - Array of assignment IDs
 * @returns Map of assignmentId -> color
 */
export async function getAssignmentColors(
  token: string,
  assignmentIds: number[],
): Promise<Map<number, string>> {
  const colorMap = new Map<number, string>()

  if (assignmentIds.length === 0)
    return colorMap

  try {
    const configNames = assignmentIds.map(id => `EMUI_RESOURCE_ASSIGNMENT_COLOR_${id}`)
    const configMap = await batchGetSysConfig(token, configNames)

    for (const [configName, value] of configMap.entries()) {
      if (configName.startsWith('EMUI_RESOURCE_ASSIGNMENT_COLOR_')) {
        const assignmentId = Number(configName.replace('EMUI_RESOURCE_ASSIGNMENT_COLOR_', ''))
        if (!Number.isNaN(assignmentId)) {
          colorMap.set(assignmentId, value)
        }
      }
    }
  }
  catch (error) {
    console.error('Failed to batch get assignment colors:', error)
  }

  return colorMap
}

/**
 * Get default color for a resource
 * @param token - Auth token
 * @param resourceId - Resource ID
 * @returns Color hex string or null if not configured
 */
export async function getResourceDefaultColor(token: string, resourceId: number): Promise<string | null> {
  try {
    const configName = `EMUI_RESOURCE_DEFAULT_COLOR_${resourceId}`
    const config = await getSysConfig(token, configName)
    return config?.value || null
  }
  catch (error) {
    console.error(`Failed to get default color for resource ${resourceId}:`, error)
    return null
  }
}

/**
 * Set default color for a resource
 * @param token - Auth token
 * @param resourceId - Resource ID
 * @param color - Color hex string (e.g., '#3b82f6')
 * @returns true if successful
 */
export async function setResourceDefaultColor(
  token: string,
  resourceId: number,
  color: string,
): Promise<boolean> {
  try {
    const configName = `EMUI_RESOURCE_DEFAULT_COLOR_${resourceId}`
    await setSysConfig(
      token,
      configName,
      color,
      `Default color for resource ${resourceId}`,
      'S',
    )
    return true
  }
  catch (error) {
    console.error(`Failed to set default color for resource ${resourceId}:`, error)
    return false
  }
}

/**
 * Batch get default colors for multiple resources
 * @param token - Auth token
 * @param resourceIds - Array of resource IDs
 * @returns Map of resourceId -> color
 */
export async function getResourceDefaultColors(
  token: string,
  resourceIds: number[],
): Promise<Map<number, string>> {
  const colorMap = new Map<number, string>()

  if (resourceIds.length === 0)
    return colorMap

  try {
    const configNames = resourceIds.map(id => `EMUI_RESOURCE_DEFAULT_COLOR_${id}`)
    const configMap = await batchGetSysConfig(token, configNames)

    for (const [configName, value] of configMap.entries()) {
      if (configName.startsWith('EMUI_RESOURCE_DEFAULT_COLOR_')) {
        const resourceId = Number(configName.replace('EMUI_RESOURCE_DEFAULT_COLOR_', ''))
        if (!Number.isNaN(resourceId)) {
          colorMap.set(resourceId, value)
        }
      }
    }
  }
  catch (error) {
    console.error('Failed to batch get resource default colors:', error)
  }

  return colorMap
}

/**
 * Get all assignments for a date range across all resources
 * @param token - Auth token
 * @param start - Start date
 * @param end - End date
 * @returns Array of assignments with resource info
 */
export async function getAllAssignmentsForExport(
  token: string,
  start: Date,
  end: Date,
): Promise<Array<{ assignment: ResourceAssignment, resourceName: string }>> {
  try {
    const filter = `AssignDateFrom ge ${formatTimestampForFilter(start)} and AssignDateFrom lt ${formatTimestampForFilter(end)}`
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/S_ResourceAssignment`,
      {
        token,
        searchParams: {
          $select: 'S_ResourceAssignment_ID,Name,AssignDateFrom,AssignDateTo,S_Resource_ID',
          $orderby: 'AssignDateFrom',
          $filter: filter,
        } satisfies SearchParams,
      },
    )

    const result: Array<{ assignment: ResourceAssignment, resourceName: string }> = []

    for (const r of res.records ?? []) {
      const resourceId = Number(r.S_Resource_ID?.id ?? r.S_Resource_ID ?? 0)
      if (!resourceId)
        continue

      const assignment: ResourceAssignment = {
        id: Number(r.id),
        name: String(r.Name ?? ''),
        from: String(r.AssignDateFrom),
        to: r.AssignDateTo ? String(r.AssignDateTo) : undefined,
      }

      try {
        const resourceRes = await apiFetch<{ records: any[] }>(
          `${API_V1}/models/S_Resource?$filter=S_Resource_ID eq ${resourceId}&$select=Name&$top=1`,
          { token },
        )
        const resourceName = resourceRes.records?.[0]?.Name || `Resource #${resourceId}`

        result.push({ assignment, resourceName: String(resourceName) })
      }
      catch {
        result.push({ assignment, resourceName: `Resource #${resourceId}` })
      }
    }

    return result
  }
  catch (error) {
    console.error('Failed to get assignments for export:', error)
    return []
  }
}
