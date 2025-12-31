package tw.idempiere.medicare.helper;
import com.google.gson.*;

public class SuggestionParser {

    public static String buildReadableSuggestion(String jsonString) {

        StringBuilder sb = new StringBuilder();

        Gson gson = new Gson();
        JsonElement rootElement = JsonParser.parseString(jsonString);

        // 1️⃣ 最外層一定是 array
        if (!rootElement.isJsonArray()) {
            return "Invalid suggestion format";
        }

        JsonArray rootArray = rootElement.getAsJsonArray();
        if (rootArray.size() == 0) {
            return "";
        }

        // 2️⃣ 取第 0 筆
        JsonObject firstObj = rootArray.get(0).getAsJsonObject();

        if (!firstObj.has("output") || !firstObj.get("output").isJsonArray()) {
            return "";
        }

        JsonArray outputArray = firstObj.getAsJsonArray("output");

        // 3️⃣ Loop 每一段 section
        for (JsonElement el : outputArray) {

            if (!el.isJsonObject()) {
                continue;
            }

            JsonObject section = el.getAsJsonObject();

            String sectionName = section.has("section_name")
                    ? section.get("section_name").getAsString()
                    : "";

            String sectionContent = section.has("section_content")
                    ? section.get("section_content").getAsString()
                    : "";

            if (!sectionName.isEmpty()) {
                sb.append("【")
                  .append(sectionName)
                  .append("】\n");
            }

            if (!sectionContent.isEmpty()) {
                sb.append(sectionContent)
                  .append("\n");
            }

            // 每段空一行（UI 很重要）
            sb.append("\n");
        }

        return sb.toString().trim();
    }
}
