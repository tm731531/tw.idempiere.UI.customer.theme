import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

export interface MomData {
    id: number
    documentDate: string
    name: string
    description?: string
    nightActivity?: string
    beforeSleepStatus?: string
    lastNightSleep?: string
    morningMentalStatus?: string
    breakfast?: string
    dailyActivity?: string
    lunch?: string
    outgoing?: string
    dinner?: string
    companionship?: string
    excretionStatus?: string
    bathing?: string
    safetyIncident?: string
}

function getIdentifier(val: any): string | undefined {
    if (!val) return undefined
    if (typeof val === 'object' && val.identifier) return String(val.identifier)
    return String(val)
}

export async function listMomData(
    token: string,
    filter?: {
        dateFrom?: string
        dateTo?: string
    },
    pagination?: { top?: number; skip?: number }
): Promise<{ records: MomData[]; totalCount?: number }> {
    // Using PascalCase as seen in user JSON: DateDoc, NightActivity, BeforeSleepStatus, etc.
    const searchParams: Record<string, string | number | boolean> = {
        $select: 'Z_momSystem_ID,DateDoc,Name,Description,NightActivity,BeforeSleepStatus,LastNightSleep,MorningMentalStatus,Breakfast,DailyActivity,Lunch,outgoing,Dinner,Companionship,ExcretionStatus,Bathing,SafetyIncident',
        $orderby: 'DateDoc desc',
    }

    if (pagination?.top) searchParams.$top = pagination.top
    if (pagination?.skip) searchParams.$skip = pagination.skip

    const filters: string[] = []
    if (filter?.dateFrom) {
        filters.push(`DateDoc ge '${filter.dateFrom} 00:00:00'`)
    }
    if (filter?.dateTo) {
        filters.push(`DateDoc le '${filter.dateTo} 23:59:59'`)
    }

    if (filters.length > 0) {
        searchParams.$filter = filters.join(' and ')
    }

    const res = await apiFetch<{ records: any[]; 'row-count'?: number }>(
        `${API_V1}/models/Z_momSystem`,
        { token, searchParams }
    )

    const records: MomData[] = (res.records ?? []).map((r) => ({
        id: Number(r.id),
        documentDate: String(r.DateDoc || ''),
        name: String(r.Name || ''),
        description: r.Description ? String(r.Description) : undefined,
        nightActivity: getIdentifier(r.NightActivity),
        beforeSleepStatus: getIdentifier(r.BeforeSleepStatus),
        lastNightSleep: getIdentifier(r.LastNightSleep),
        morningMentalStatus: getIdentifier(r.MorningMentalStatus),
        breakfast: getIdentifier(r.Breakfast),
        dailyActivity: getIdentifier(r.DailyActivity),
        lunch: getIdentifier(r.Lunch),
        outgoing: getIdentifier(r.outgoing),
        dinner: getIdentifier(r.Dinner),
        companionship: getIdentifier(r.Companionship),
        excretionStatus: getIdentifier(r.ExcretionStatus),
        bathing: getIdentifier(r.Bathing),
        safetyIncident: getIdentifier(r.SafetyIncident),
    }))

    return {
        records,
        totalCount: res['row-count'] ?? records.length,
    }
}
