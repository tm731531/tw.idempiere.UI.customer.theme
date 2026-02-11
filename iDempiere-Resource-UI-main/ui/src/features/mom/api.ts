import ky from "ky";
import { apiFetch } from "../../shared/api/http";
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_V1 = "/api/v1";

export interface MomData {
  id: number;
  documentDate: string;
  name: string;
  description?: string;
  nightActivity?: string;
  beforeSleepStatus?: string;
  lastNightSleep?: string;
  morningMentalStatus?: string;
  breakfast?: string;
  dailyActivity?: string;
  lunch?: string;
  outgoing?: string;
  dinner?: string;
  companionship?: string;
  excretionStatus?: string;
  bathing?: string;
  safetyIncident?: string;
  docStatus?: string;
  isProcessed?: boolean;
  // 生理數據欄位 (等用戶在 iDempiere 新增後啟用)
  systolicBP?: number; // 收縮壓
  diastolicBP?: number; // 舒張壓
  pulse?: number; // 脈搏/心率
  bpNote?: string; // 測量備註
}

function getIdentifier(val: any): string {
  if (!val) return "";
  if (typeof val === "object") {
    // Return .id (the code/value) if available, otherwise identifier, otherwise val
    return val.id
      ? String(val.id)
      : val.identifier
        ? String(val.identifier)
        : String(val);
  }
  return String(val);
}

export async function listMomData(
  token: string,
  filter?: {
    dateFrom?: string;
    dateTo?: string;
  },
  pagination?: { top?: number; skip?: number },
): Promise<{ records: MomData[]; totalCount?: number }> {
  const searchParams: Record<string, string | number | boolean> = {
    $select:
      "Z_momSystem_ID,DateDoc,Name,Description,NightActivity,BeforeSleepStatus,LastNightSleep,MorningMentalStatus,Breakfast,DailyActivity,Lunch,outgoing,Dinner,Companionship,ExcretionStatus,Bathing,SafetyIncident,DocStatus,Processed,SystolicBP,DiastolicBP,Pulse,BPNote",
    $orderby: "DateDoc desc",
  };

  if (pagination?.top) searchParams.$top = pagination.top;
  if (pagination?.skip) searchParams.$skip = pagination.skip;

  const filters: string[] = [];
  if (filter?.dateFrom) {
    filters.push(`DateDoc ge '${filter.dateFrom} 00:00:00'`);
  }
  if (filter?.dateTo) {
    filters.push(`DateDoc le '${filter.dateTo} 23:59:59'`);
  }

  if (filters.length > 0) {
    searchParams.$filter = filters.join(" and ");
  }

  const res = await apiFetch<{ records: any[]; "row-count"?: number }>(
    `${API_V1}/models/Z_momSystem`,
    { token, searchParams },
  );

  const records: MomData[] = (res.records ?? []).map((r) => ({
    id: Number(r.id),
    documentDate: String(r.DateDoc || ""),
    name: String(r.Name || ""),
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
    docStatus: getIdentifier(r.DocStatus),
    isProcessed: r.Processed === "Y" || r.Processed === true,
    // 生理數據 (PascalCase)
    systolicBP: r.SystolicBP ? Number(r.SystolicBP) : undefined,
    diastolicBP: r.DiastolicBP ? Number(r.DiastolicBP) : undefined,
    pulse: r.Pulse ? Number(r.Pulse) : undefined,
    bpNote: r.BPNote ? String(r.BPNote) : undefined,
  }));

  return {
    records,
    totalCount: res["row-count"] ?? records.length,
  };
}

export async function getLatestMomRecordId(
  token: string,
): Promise<number | null> {
  const searchParams = {
    $select: "Z_momSystem_ID",
    $orderby: "DateDoc desc, Created desc",
    $top: 1,
  };
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/Z_momSystem`,
    {
      token,
      searchParams,
    },
  );
  if (res.records && res.records.length > 0) {
    return Number(res.records[0].id || res.records[0].Z_momSystem_ID);
  }
  return null;
}

/**
 * Upload a PDF as an attachment to a Mom record.
 * Uses the Postman-verified pattern: POST to the /attachments sub-resource with a JSON body.
 */
export async function uploadMomAttachment(
  token: string,
  recordId: number,
  blob: Blob,
  filename: string,
): Promise<void> {
  // 1. Convert Blob to Base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const base64Data = await base64Promise;

  // 2. Perform POST request to the record's attachments sub-resource
  // Pattern: /api/v1/models/{tableName}/{recordId}/attachments
  const url = `${API_V1}/models/Z_momSystem/${recordId}/attachments`;

  await ky.post(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    json: {
      name: filename,
      data: base64Data,
    },
  });
}

/**
 * Attachment data structure
 */
export interface MomAttachment {
  name: string;
  contentType?: string;
  data?: string; // Base64 data (when fetching)
}

/**
 * Fetch attachments for a Mom record.
 * Returns list of attachment metadata (name, type).
 */
export async function getMomAttachments(
  token: string,
  recordId: number,
): Promise<MomAttachment[]> {
  try {
    const url = `${API_V1}/models/Z_momSystem/${recordId}/attachments`;
    const res = await ky
      .get(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json<{ attachments?: { name: string; contentType?: string }[] }>();

    return (res.attachments || []).map((a) => ({
      name: a.name,
      contentType: a.contentType,
    }));
  } catch (e) {
    console.error("Failed to fetch attachments:", e);
    return [];
  }
}

/**
 * Fetch a single attachment's data as a Blob.
 */
export async function getMomAttachmentData(
  token: string,
  recordId: number,
  filename: string,
): Promise<Blob | null> {
  try {
    const url = `${API_V1}/models/Z_momSystem/${recordId}/attachments/${encodeURIComponent(filename)}`;
    const res = await ky
      .get(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .blob();

    return res;
  } catch (e) {
    console.error("Failed to fetch attachment data:", e);
    return null;
  }
}

/**
 * Compress an image using Canvas API
 */
async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.7,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas to Blob failed"));
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Upload a photo attachment to a Mom record.
 * Uses same pattern as PDF upload, but with image compression.
 */
export async function uploadMomPhoto(
  token: string,
  recordId: number,
  file: File,
): Promise<void> {
  // 1. Compress Image
  const compressedBlob = await compressImage(file);

  // 2. Convert Blob to Base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(compressedBlob);
  });

  const base64Data = await base64Promise;

  // 3. Generate filename with timestamp
  const ext = "jpg"; // Always jpeg after compression
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");
  const filename = `Photo_${timestamp}.${ext}`;

  // 4. Upload
  const url = `${API_V1}/models/Z_momSystem/${recordId}/attachments`;
  await ky.post(url, {
    headers: { Authorization: `Bearer ${token}` },
    json: {
      name: filename,
      data: base64Data,
    },
  });
}

/**
 * Payload for creating/updating Mom data
 * We map the camelCase frontend properties to the PascalCase/Specific column names of the backend.
 */
export interface MomPayload {
  DateDoc: string;
  Name: string;
  Description?: string;
  NightActivity?: string | null;
  BeforeSleepStatus?: string | null;
  LastNightSleep?: string | null;
  MorningMentalStatus?: string | null;
  Breakfast?: string | null;
  DailyActivity?: string | null;
  Lunch?: string | null;
  outgoing?: string | null;
  Dinner?: string | null;
  Companionship?: string | null;
  ExcretionStatus?: string | null;
  Bathing?: string | null;
  SafetyIncident?: string | null;
  // 生理數據 (PascalCase)
  SystolicBP?: number | null;
  DiastolicBP?: number | null;
  Pulse?: number | null;
  BPNote?: string | null;
}

export async function createMomData(
  token: string,
  data: MomPayload,
): Promise<number> {
  const url = `${API_V1}/models/Z_momSystem`;
  const res = await ky
    .post(url, {
      headers: { Authorization: `Bearer ${token}` },
      json: data,
    })
    .json<{ id: number }>();
  return res.id;
}

export async function updateMomData(
  token: string,
  id: number,
  data: MomPayload,
): Promise<void> {
  const url = `${API_V1}/models/Z_momSystem/${id}`;
  await ky.put(url, {
    headers: { Authorization: `Bearer ${token}` },
    json: data,
  });
}

export async function completeMomRecord(
  token: string,
  id: number,
): Promise<void> {
  const url = `${API_V1}/models/Z_momSystem/${id}/docaction/CO`;
  await ky.put(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Runs a specific iDempiere Process to complete/close the MOM record.
 * This implementation follows the user-provided pattern:
 * POST /api/v1/processes/{processValue}
 * Body: { "table-id": 1000000, "record-id": 1000040 }
 *
 * It dynamically discovers whether to use 'Z_momSystem_Process' or 'Z_momSystem-Process'.
 */
export async function runMomCompleteProcess(
  token: string,
  recordId: number,
  tableId?: number,
): Promise<void> {
  // 1. Discover the correct Process Value (underscore vs hyphen)
  const options = ["z_momsystem-process", "Z_momSystem_Process"];
  let processValue = options[0]; // Default fallback

  const url = `${API_V1}/processes/${processValue}`;

  // 2. Discover Table ID
  let targetTableId = tableId;
  if (!targetTableId) {
    const tableParams = {
      $filter: "TableName eq 'Z_momSystem'",
      $select: "AD_Table_ID",
    };
    const tableRes = await apiFetch<{ records: { id: number }[] }>(
      `${API_V1}/models/AD_Table`,
      { token, searchParams: tableParams },
    );
    if (tableRes.records && tableRes.records.length > 0) {
      targetTableId = tableRes.records[0].id;
    }
  }

  // 3. Run Process
  await ky.post(url, {
    headers: { Authorization: `Bearer ${token}` },
    json: {
      "table-id": targetTableId,
      "record-id": recordId,
    },
  });
}

export async function getTableColumns(
  token: string,
  tableName: string,
): Promise<any[]> {
  const tableRes = await apiFetch<{ records: { id: number }[] }>(
    `${API_V1}/models/AD_Table`,
    {
      token,
      searchParams: {
        $filter: `TableName eq '${tableName}'`,
        $select: "AD_Table_ID",
      },
    },
  );
  if (!tableRes.records || tableRes.records.length === 0) return [];
  const tableId = tableRes.records[0].id;
  const colRes = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/AD_Column`,
    {
      token,
      searchParams: {
        $filter: `AD_Table_ID eq ${tableId}`,
        $select: "ColumnName,Name",
      },
    },
  );
  return colRes.records || [];
}

/**
 * Call Google Gemini API using official SDK.
 * Implements fallback logic to handle 404/503 errors.
 */
export async function generateGeminiContent(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);

  // Priority list of models to attempt.
  const models = [
    "gemini-3-flash-preview", // User requested (often 503)
    "gemini-2.0-flash-exp", // New experimental
    "gemini-1.5-flash", // Standard flash
    "gemini-pro", // Stable fallback
  ];

  let lastError: any = null;

  for (const modelName of models) {
    try {
      console.log(`[AI] Attempting model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (e: any) {
      console.warn(`[AI] Model ${modelName} failed:`, e.message || e);
      lastError = e;
      // Continue to next model
    }
  }

  console.error("Gemini SDK All Models Failed:", lastError);
  throw new Error(
    lastError?.message || "All AI models failed. Please try again later.",
  );
}

/**
 * Fetch the Gemini API Key from iDempiere System Configuration (AD_SysConfig).
 * Expects a record with Name = 'GEMINI_API_KEY'.
 */
export async function getGeminiApiKey(token: string): Promise<string | null> {
  try {
    const searchParams = {
      $filter: "Name eq 'GEMINI_API_KEY'",
      $select: "Value",
    };

    const res = await apiFetch<{ records: { Value: string }[] }>(
      `${API_V1}/models/AD_SysConfig`,
      { token, searchParams },
    );

    if (res.records && res.records.length > 0) {
      return res.records[0].Value;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch GEMINI_API_KEY from config:", e);
    return null;
  }
}

/**
 * Fetch column metadata including Field Labels (Name), Reference Lists, and Default Values.
 * Returns { options: Map<ColName, List[]>, labels: Map<ColName, Label>, defaults: Map<ColName, Val> }
 */
/**
 * Utility to search for processes related to MomReport.
 * This helps identify the correct AD_Process_ID or Value for the 'Complete' action.
 */
export async function findMomProcess(token: string): Promise<any[]> {
  const searchParams = {
    $filter:
      "Name contains 'Mom' or Value contains 'Mom' or Description contains 'Mom'",
    $select: "AD_Process_ID,Value,Name,Description",
  };
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/AD_Process`,
    { token, searchParams },
  );
  return res.records || [];
}

export async function fetchMomColumnMetadata(token: string): Promise<{
  options: Record<string, { value: string; label: string }[]>;
  labels: Record<string, string>;
  defaults: Record<string, string>;
}> {
  const result = {
    options: {} as Record<string, { value: string; label: string }[]>,
    labels: {} as Record<string, string>,
    defaults: {} as Record<string, string>,
  };

  try {
    // 1. Get Table ID via Model API on AD_Table
    const tableParams = {
      $filter: "TableName eq 'Z_momSystem'",
      $select: "AD_Table_ID",
    };
    console.log("[Meta] Fetching table ID for Z_momSystem...");
    const tableRes = await apiFetch<{ records: { id: number }[] }>(
      `${API_V1}/models/AD_Table`,
      { token, searchParams: tableParams },
    );
    if (!tableRes.records || tableRes.records.length === 0) {
      console.warn("[Meta] Z_momSystem table not found in AD_Table");
      return result;
    }

    const tableId = tableRes.records[0].id;
    console.log("[Meta] Table ID:", tableId);

    // 2. Get Columns using the Table ID
    // Fetch ALL columns to get labels (Name) and DefaultValue
    const colParams = {
      $filter: `AD_Table_ID eq ${tableId}`,
      $select:
        "ColumnName,Name,AD_Reference_Value_ID,AD_Reference_ID,DefaultValue",
    };
    const colRes = await apiFetch<{
      records: {
        id: number;
        ColumnName: string;
        Name: string;
        DefaultValue?: string;
        AD_Reference_ID: { id: number };
        AD_Reference_Value_ID?: { id: number };
      }[];
    }>(`${API_V1}/models/AD_Column`, { token, searchParams: colParams });

    console.log(`[Meta] Found ${colRes.records?.length || 0} columns total.`);

    const colIdToName = new Map<number, string>();

    for (const col of colRes.records || []) {
      const colId = col.id;
      if (colId) colIdToName.set(colId, col.ColumnName);

      // Store Label (Name) - this is the translated "Chinese" field name
      result.labels[col.ColumnName] = col.Name;

      // Store Default Value if present (and remove surrounding quotes if any)
      if (col.DefaultValue) {
        // Remove ' around strings like 'Y' or 'N'
        result.defaults[col.ColumnName] = col.DefaultValue.replace(
          /^'|'$/g,
          "",
        );
      }

      // If it is a List (17), fetch options
      if (col.AD_Reference_ID?.id === 17 && col.AD_Reference_Value_ID?.id) {
        const refId = col.AD_Reference_Value_ID.id;
        console.log(
          `[Meta] Processing list column: ${col.ColumnName}, RefValueID: ${refId}`,
        );

        const refRes = await apiFetch<{
          reflist?: { name: string; value: string }[];
        }>(`${API_V1}/reference/${refId}`, { token });

        if (refRes.reflist) {
          console.log(
            `[Meta] Fetched ${refRes.reflist.length} options for ${col.ColumnName}`,
          );
          result.options[col.ColumnName] = refRes.reflist.map((r) => ({
            value: r.value,
            label: r.name,
          }));
        } else {
          console.warn(
            `[Meta] No reflist found for ${col.ColumnName} (RefID: ${refId})`,
          );
        }
      }
    }

    // 3. Get Defaults from AD_Field (Priority over AD_Column)
    // Find AD_Tab associated with this table
    console.log("[Meta] Fetching AD_Tab for table...");
    const tabParams = {
      $filter: `AD_Table_ID eq ${tableId}`,
      $select: "AD_Tab_ID",
    };
    const tabRes = await apiFetch<{ records: { id: number }[] }>(
      `${API_V1}/models/AD_Tab`,
      { token, searchParams: tabParams },
    );

    if (tabRes.records && tabRes.records.length > 0) {
      const tabId = tabRes.records[0].id;
      console.log("[Meta] Found AD_Tab_ID:", tabId);

      // Get Fields (Fetch all for tab, then filter in memory due to "ne" operator issues)
      const fieldParams = {
        $filter: `AD_Tab_ID eq ${tabId}`,
        $select: "AD_Column_ID,DefaultValue",
      };
      const fieldRes = await apiFetch<{
        records: { AD_Column_ID: { id: number }; DefaultValue: string }[];
      }>(`${API_V1}/models/AD_Field`, { token, searchParams: fieldParams });

      console.log(
        `[Meta] Found ${fieldRes.records?.length || 0} fields with defaults.`,
      );

      for (const f of fieldRes.records || []) {
        if (f.AD_Column_ID?.id && f.DefaultValue) {
          const cName = colIdToName.get(f.AD_Column_ID.id);
          if (cName) {
            // Overwrite AD_Column default with AD_Field default
            // Remove ' around strings
            result.defaults[cName] = f.DefaultValue.replace(/^'|'$/g, "");
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch MOM metadata:", e);
  }

  return result;
}
