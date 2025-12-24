package tw.idempiere.medicare.process;

import org.compiere.model.*;
import org.compiere.util.CLogger;
import org.compiere.util.Env;
import org.compiere.process.SvrProcess;

import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.io.BufferedReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Base64;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import java.util.ArrayList;
import java.util.List;

//定義 Ragic 資料結構
class RagicSub {
	String 症狀;
	JsonArray 可見徵象;
	String 症狀持續時間;
	String 側別;
	JsonArray 既往治療;
}

class RagicData {
	String 病例編號;
	String 姓名;
	String 性別;
	String 身分證字號;
	String 出生年月日;
	String 年齡;
	String 手機;
	String 市話;
	String 職業;
	String 身高;
	String 體重;
	String BMI;
	String 過敏史;
	String 有無保險;
	JsonObject _subtable_1008665;
}

public class RagicFetchToPO extends SvrProcess {

	private int record_ID;
	private String tableName = "z_medicare"; // 主表 DB Table 名稱

	@Override
	protected void prepare() {
		record_ID = getRecord_ID();
	}

	@Override
	protected String doIt() throws Exception {

		// 1. 取得 Ragic 資料
		String urlString = "https://ap10.ragic.com/knockersragic/test2/4?v=3";
		URL url = new URL(urlString);
		HttpURLConnection conn = (HttpURLConnection) url.openConnection();
		conn.setRequestMethod("GET");

		String token = "Z0gzbVNqUzRsNXNKa0VvN3FXbWl2NG1vMDJMRUJEcDlQTTc1RFRlV1JhbmZJMXRrNzZiQ3RxbmtKY0I1QlRIQkZ6Nkh1M1BpZE9FPQ==";
		conn.setRequestProperty("Authorization", "Basic " + token);

		int responseCode = conn.getResponseCode();
		if (responseCode != 200) {
			throw new RuntimeException("Failed : HTTP error code : " + responseCode);
		}

		BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
		StringBuilder sb = new StringBuilder();
		String line;
		while ((line = br.readLine()) != null) {
			sb.append(line);
		}
		br.close();

		// 2. Gson 解析
		Gson gson = new Gson();
		JsonObject root = gson.fromJson(sb.toString(), JsonObject.class);
		JsonObject dataJson = root.getAsJsonObject("0");

		// 3. 取得 PO（透過 MTable + PO）
		MTable table = MTable.get(Env.getCtx(), tableName);
		PO po = table.getPO(record_ID, get_TrxName());
//
//		// 4. 更新主表欄位
//		po.set_ValueOfColumn("CaseNo", dataJson.get("病例編號").getAsString());
//		po.set_ValueOfColumn("Name", dataJson.get("姓名").getAsString());
//		po.set_ValueOfColumn("Gender", dataJson.get("性別").getAsString());
//		po.set_ValueOfColumn("IDNumber", dataJson.get("身分證字號").getAsString());
//		po.set_ValueOfColumn("BirthDate", dataJson.get("出生年月日").getAsString());
//		po.set_ValueOfColumn("Age", dataJson.get("年齡").getAsString());
//		po.set_ValueOfColumn("Mobile", dataJson.get("手機").getAsString());
//		po.set_ValueOfColumn("Phone", dataJson.get("市話").getAsString());
//		po.set_ValueOfColumn("Occupation", dataJson.get("職業").getAsString());
//		po.set_ValueOfColumn("Height", dataJson.get("身高").getAsString());
//		po.set_ValueOfColumn("Weight", dataJson.get("體重").getAsString());
//		po.set_ValueOfColumn("BMI", dataJson.get("BMI").getAsString());
//		po.set_ValueOfColumn("AllergyHistory", dataJson.get("過敏史").getAsString());
//		po.set_ValueOfColumn("Insurance", dataJson.get("有無保險").getAsString());
//		
		// 4. 更新欄位
		po.set_ValueOfColumn("Age", dataJson.has("年齡") ? dataJson.get("年齡").getAsInt() : 30);
		po.set_ValueOfColumn("Sex",
				dataJson.has("性別") ?  (dataJson.get("性別").getAsString().equals("男") ? "M" : "F") : "M");
//		po.set_ValueOfColumn("Height", dataJson.get("身高").getAsNumber());
//		po.set_ValueOfColumn("Weight", dataJson.get("體重").getAsNumber());
//		po.set_ValueOfColumn("BMI", dataJson.get("BMI").getAsNumber());
		// Weight
		BigDecimal weight = null;
		if (dataJson.has("體重") && !dataJson.get("體重").getAsString().isEmpty()) {
		    try {
		        weight = new BigDecimal(dataJson.get("體重").getAsString());
		    } catch (NumberFormatException e) {
		        weight = null;
		    }
		}
		po.set_ValueOfColumn("Weight", weight);

		// BMI
		BigDecimal bmi = null;
		if (dataJson.has("BMI") && !dataJson.get("BMI").getAsString().isEmpty()) {
		    try {
		        bmi = new BigDecimal(dataJson.get("BMI").getAsString());
		    } catch (NumberFormatException e) {
		        bmi = null;
		    }
		}
		po.set_ValueOfColumn("BMI", bmi);

		// Height 如果是整數欄位
		BigDecimal height = null;
		if (dataJson.has("身高") && !dataJson.get("身高").getAsString().isEmpty()) {
		    try {
		        height =new BigDecimal(dataJson.get("身高").getAsString());
		    } catch (NumberFormatException e) {
		        height = null;
		    }
		}
		po.set_ValueOfColumn("Height", height);
//
		po.set_ValueOfColumn("Occupation",
				(dataJson.has("職業") ? dataJson.get("職業").getAsString() : "") + " / 久站:"
						+ (dataJson.has("久站（hr)") ? dataJson.get("久站（hr)").getAsString() : "0") + " / 久坐:"
						+ (dataJson.has("久坐（hr)") ? dataJson.get("久坐（hr)").getAsString() : "0"));
		po.set_ValueOfColumn("ActivityLevel", dataJson.has("運動習慣") ? dataJson.get("運動習慣").getAsString() : "");
		po.set_ValueOfColumn("Symptoms", dataJson.has("選項") ? dataJson.get("選項").getAsString() : "");
		po.set_ValueOfColumn("VisibleSigns", dataJson.has("選項2") ? dataJson.get("選項2").getAsString() : "");
		po.set_ValueOfColumn("SymptomDuration", dataJson.has("持續多久") ? dataJson.get("持續多久").getAsString() : "");
		po.set_ValueOfColumn("Laterality", dataJson.has("選項11") ? dataJson.get("選項11").getAsString() : "");
		po.set_ValueOfColumn("PreviousTreatments","未治療/彈性襪/藥物/硬化/雷射/手術");
		po.set_ValueOfColumn("PregnancyHistory", dataJson.has("選項10") ? dataJson.get("選項10").getAsString() : "不適用");
		po.set_ValueOfColumn("Comorbidities", dataJson.has("過去疾病史") ? gson.toJson(dataJson.get("過去疾病史")) : "");
		po.set_ValueOfColumn("Medications", dataJson.has("藥物") ? dataJson.get("藥物").getAsString() : "");
		po.set_ValueOfColumn("Allergies", dataJson.has("過敏史") ? dataJson.get("過敏史").getAsString() : "");
		po.set_ValueOfColumn("PEHistory", ""); // Ragic 沒有這欄位，先空白
		po.set_ValueOfColumn("PatientGoals", dataJson.has("選項13") ? gson.toJson(dataJson.get("選項13")) : "");

		// 5. Clinic Context (可由前端或自訂欄位填)
		po.set_ValueOfColumn("Region", "台灣");
		po.set_ValueOfColumn("PreferredModalities", "保守治療/硬化/EVLA/RFA/膠水/微創手術");
		po.set_ValueOfColumn("TimeBudget", "每週可配合");
		po.set_ValueOfColumn("CostSensitivity", "中");
		po.set_ValueOfColumn("FollowUpChannel", "LINE");

		// 5. 子表資料轉 JSON 字串存到主表欄位
//		if (dataJson.has("_subtable_1008665")) {
//			JsonObject subtable = dataJson.getAsJsonObject("_subtable_1008665");
//			po.set_ValueOfColumn("SubtableData", gson.toJson(subtable));
//		}

		// 6. 儲存
		if (!po.save()) {
			throw new RuntimeException("Failed to save record");
		}
		return "Ragic data imported successfully into record " + record_ID;
	}
}