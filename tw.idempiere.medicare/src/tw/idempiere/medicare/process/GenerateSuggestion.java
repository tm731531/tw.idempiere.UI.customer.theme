package tw.idempiere.medicare.process;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import org.adempiere.exceptions.AdempiereException;
import org.compiere.model.MColumn;
import org.compiere.model.MTable;
import org.compiere.model.PO;
import org.compiere.process.SvrProcess;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.HttpURLConnection;
import java.net.URL;
import java.io.OutputStream;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
public class GenerateSuggestion extends SvrProcess {

	private int recordId;

    @Override
    protected void prepare() {
        recordId = getRecord_ID();
    }

    @Override
    protected String doIt() throws Exception {

        if (recordId <= 0) {
            throw new AdempiereException("No record selected");
        }

        // 🔑 這裡直接用 Table Name（你改成你的）
        String tableName = "z_medicare";

        // 1️⃣ 動態取得 PO
        MTable table = MTable.get(getCtx(), tableName);
        PO po = table.getPO(recordId, get_TrxName());

        if (po == null) {
            throw new AdempiereException("Record not found");
        }
        // 取得 PO
        String suggestion = buildSuggestion(po);
//        // 2️⃣ 組 Suggestion
//        String suggestion = buildSuggestion(table, po);

        // 3️⃣ 回寫欄位
        po.set_ValueOfColumn("Description", suggestion);
        po.saveEx();

        return "Suggestion generated";
    }
    private String buildSuggestion(PO po) {
    	
    	JsonObject json = new JsonObject(); // 空 {}

    	try {
			return postToWebhook(
			    "https://n8n.hcchiang.com/webhook/6a1c49f3-2da8-41e4-8171-f196998e4cbf",
			    json
			);
		} catch (Exception e) {
			// TODO Auto-generated catch block
			return e.getMessage();
		}
    	
//        StringBuilder sb = new StringBuilder();
//
//        // 取出必要欄位
//        Integer age = (Integer) po.get_Value("Age");
//        String sex = (String) po.get_Value("Sex");
//        BigDecimal bmi = (BigDecimal) po.get_Value("BMI");
//        String occupation = (String) po.get_Value("Occupation");
//        String symptoms = (String) po.get_Value("Symptoms");
//        String visibleSigns = (String) po.get_Value("VisibleSigns");
//        String previousTreatments = (String) po.get_Value("PreviousTreatments");
//        String patientGoals = (String) po.get_Value("PatientGoals");
//
//        // 1️⃣ 基本建議
//        if (age != null) {
//            sb.append("年齡：").append(age).append("歲\n");
//        }
//        if (sex != null) {
//            sb.append("性別：").append(sex.equals("M") ? "男" : "女").append("\n");
//        }
//        if (bmi != null) {
//            sb.append("BMI：").append(bmi).append("\n");
//            if (bmi.compareTo(new BigDecimal("30")) >= 0) {
//                sb.append("建議：BMI偏高，可進行減重與下肢運動改善血流。\n");
//            }
//        }
//
//        // 2️⃣ 職業/久站久坐
//        if (occupation != null && !occupation.isEmpty()) {
//            sb.append("職業及活動量：").append(occupation).append("\n");
//            if (occupation.contains("久站")) {
//                sb.append("建議：久站者可穿彈性襪，注意下肢抬高休息。\n");
//            }
//        }
//
//        // 3️⃣ 症狀/可見徵象
//        if (symptoms != null && !symptoms.isEmpty()) {
//            sb.append("症狀：").append(symptoms).append("\n");
//            if (symptoms.contains("疼痛") || symptoms.contains("酸脹")) {
//                sb.append("建議：可搭配保守治療（彈性襪、運動）以減緩疼痛。\n");
//            }
//        }
//        if (visibleSigns != null && !visibleSigns.isEmpty()) {
//            sb.append("可見徵象：").append(visibleSigns).append("\n");
//            if (visibleSigns.contains("曲張靜脈")) {
//                sb.append("建議：如曲張靜脈明顯，可考慮微創手術或硬化療法。\n");
//            }
//        }
//
//        // 4️⃣ 既往治療
//        if (previousTreatments != null && !previousTreatments.isEmpty()) {
//            sb.append("既往治療：").append(previousTreatments).append("\n");
//        }
//
//        // 5️⃣ 病人目標
//        if (patientGoals != null && !patientGoals.isEmpty()) {
//            sb.append("病人目標：").append(patientGoals).append("\n");
//            List<String> goals = Arrays.asList(patientGoals.split(","));
//            if (goals.contains("改善外觀")) {
//                sb.append("建議：可考慮微創手術、雷射或膠水改善外觀。\n");
//            }
//            if (goals.contains("減少疼痛")) {
//                sb.append("建議：保守治療或藥物控制疼痛。\n");
//            }
//        }
//
//        // 6️⃣ 補充文字
//        sb.append("建議：配合定期追蹤及門診超音波檢查。\n");
//
//        return sb.toString();
    }
    private String postToWebhook(String webhookUrl, JsonObject json) throws Exception {

        URL url = new URL(webhookUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        conn.setDoOutput(true);
     // ⛔ 不要太短，真的在等結果
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(60000); // 👈 至少 30~60 秒

        try (OutputStream os = conn.getOutputStream()) {
            os.write(json.toString().getBytes(StandardCharsets.UTF_8));
            os.flush();
        }

        int code = conn.getResponseCode();

        InputStream is = (code >= 400)
            ? conn.getErrorStream()
            : conn.getInputStream();

        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(is, StandardCharsets.UTF_8))) {

            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line);
            }
        }

        // 🔑 GSON parse
        return sb.toString();
    }
    private String buildSuggestion(MTable table, PO po) {

        StringBuilder sb = new StringBuilder();

        for (MColumn col : table.getColumns(false)) {

            String colName = col.getColumnName();

            // ❌ 排除系統欄位 & 自己
            if (isSkipColumn(colName)) {
                continue;
            }

            Object value = po.get_Value(colName);
            if (value == null) {
                continue;
            }

            sb.append(col.getName())   // 使用顯示名稱
              .append("：")
              .append(value)
              .append("\n");
        }

        return sb.toString();
    }
    private boolean isSkipColumn(String colName) {

        return colName.equalsIgnoreCase("Description")
            || colName.equalsIgnoreCase("AD_Client_ID")
            || colName.equalsIgnoreCase("AD_Org_ID")
            || colName.equalsIgnoreCase("IsActive")
            || colName.equalsIgnoreCase("Created")
            || colName.equalsIgnoreCase("CreatedBy")
            || colName.equalsIgnoreCase("Updated")
            || colName.equalsIgnoreCase("UpdatedBy");
    }

}
