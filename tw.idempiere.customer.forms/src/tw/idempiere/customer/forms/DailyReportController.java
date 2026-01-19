package tw.idempiere.customer.forms;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import org.adempiere.webui.util.ZKUpdateUtil;
import org.adempiere.webui.editor.WSearchEditor;
import org.compiere.model.MLookup;
import org.compiere.model.MLookupFactory;
import org.compiere.util.CLogger;
import org.compiere.util.DB;
import org.compiere.util.Env;
import org.zkoss.json.JSONArray;
import org.zkoss.json.JSONObject;
import org.zkoss.zk.ui.Component;
import org.zkoss.zk.ui.event.Event;
import org.zkoss.zk.ui.event.EventListener;
import org.zkoss.zk.ui.event.Events;
import org.zkoss.zk.ui.select.SelectorComposer;
import org.zkoss.zk.ui.select.annotation.Wire;
import org.zkoss.zk.ui.select.annotation.Listen;
import org.zkoss.zk.ui.util.Clients;
import org.zkoss.zul.Label;
import org.zkoss.zul.Window;
import org.zkoss.zul.Div;

/**
 * Controller for Daily Report UI using Chart.js.
 */
public class DailyReportController extends SelectorComposer<Window> {

    private static final long serialVersionUID = 1L;

    private static final CLogger log = CLogger.getCLogger(DailyReportController.class);

    @Wire
    private Label lblSalesToday;
    @Wire
    private Label lblPurchaseToday;
    @Wire
    private Div chartDiv;
    @Wire
    private Div bpDiv;

    private WSearchEditor bpSearch;

    @Override
    public void doAfterCompose(Window comp) throws Exception {
        super.doAfterCompose(comp);
        log.info("DailyReportController composed");

        // Initialize BP Search Editor
        int AD_Column_ID = 2163; // C_Order.C_BPartner_ID
        MLookup lookup = MLookupFactory.get(Env.getCtx(), 0, AD_Column_ID, 0, Env.getLanguage(Env.getCtx()),
                "C_BPartner_ID", 0, false, "");
        bpSearch = new WSearchEditor(lookup, "Business Partner", "", true, false, true);
        bpSearch.getComponent().setHflex("1");
        bpDiv.appendChild(bpSearch.getComponent());

        // Listen for changes
        bpSearch.getComponent().addEventListener(Events.ON_CHANGE, e -> refreshData());

        refreshData();
    }

    @Listen("onClick = #btnRefresh")
    public void onRefresh() {
        log.info("Refresh button clicked");
        refreshData();
    }

    private void refreshData() {
        JSONObject chartData = new JSONObject();
        JSONArray labels = new JSONArray();
        JSONObject datasets = new JSONObject(); // Channel Name -> List of Counts

        int todaySales = 0;
        int todayPurchase = 0;

        // Get Selected BP
        Object bpValue = bpSearch != null ? bpSearch.getValue() : null;
        Integer C_BPartner_ID = (bpValue instanceof Integer) ? (Integer) bpValue : null;

        // SQL: Group by Day and Business Partner (as Channel)
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT date_trunc('day', o.DateOrdered) as day, ");
        sql.append("bp.Name as channel, ");
        sql.append("COUNT(o.C_Order_ID) as count ");
        sql.append("FROM C_Order o ");
        sql.append("JOIN C_BPartner bp ON (o.C_BPartner_ID = bp.C_BPartner_ID) ");
        sql.append("WHERE o.AD_Client_ID=? ");
        sql.append("AND o.DateOrdered >= CURRENT_DATE - INTERVAL '7 days' ");
        if (C_BPartner_ID != null && C_BPartner_ID > 0) {
            sql.append("AND o.C_BPartner_ID=? ");
        }
        sql.append("GROUP BY day, channel ORDER BY day, channel");

        PreparedStatement pstmt = null;
        ResultSet rs = null;
        try {
            int AD_Client_ID = Env.getAD_Client_ID(Env.getCtx());
            pstmt = DB.prepareStatement(sql.toString(), null);
            pstmt.setInt(1, AD_Client_ID);
            if (C_BPartner_ID != null && C_BPartner_ID > 0) {
                pstmt.setInt(2, C_BPartner_ID);
            }
            rs = pstmt.executeQuery();

            java.util.Set<String> daysSet = new java.util.LinkedHashSet<>();
            java.util.Map<String, java.util.Map<String, Integer>> dataMap = new java.util.HashMap<>(); // Day ->
                                                                                                       // {Channel ->
                                                                                                       // Count}

            while (rs.next()) {
                String day = rs.getDate("day").toString();
                String channel = rs.getString("channel");
                int count = rs.getInt("count");

                daysSet.add(day);
                dataMap.computeIfAbsent(day, k -> new java.util.HashMap<>()).put(channel, count);
            }

            // Standardize labels
            List<String> sortedDays = new ArrayList<>(daysSet);
            for (String day : sortedDays)
                labels.add(day);

            // Fetch all unique channels
            java.util.Set<String> allChannels = new java.util.HashSet<>();
            for (java.util.Map<String, Integer> m : dataMap.values())
                allChannels.addAll(m.keySet());

            // Build individual datasets
            for (String channel : allChannels) {
                JSONArray data = new JSONArray();
                for (String day : sortedDays) {
                    data.add(dataMap.get(day).getOrDefault(channel, 0));
                }
                datasets.put(channel, data);
            }

            // Sync Today Labels (Summary)
            // For summary, we still count total Sales/Purchase for today
            todaySales = DB.getSQLValue(null,
                    "SELECT COUNT(*) FROM C_Order WHERE IsSOTrx='Y' AND AD_Client_ID=? AND DateOrdered >= CURRENT_DATE",
                    AD_Client_ID);
            todayPurchase = DB.getSQLValue(null,
                    "SELECT COUNT(*) FROM C_Order WHERE IsSOTrx='N' AND AD_Client_ID=? AND DateOrdered >= CURRENT_DATE",
                    AD_Client_ID);

            if (lblSalesToday != null)
                lblSalesToday.setValue(String.valueOf(todaySales));
            if (lblPurchaseToday != null)
                lblPurchaseToday.setValue(String.valueOf(todayPurchase));

            // Push to JS
            String jsCall = String.format("zk.afterMount(function(){ renderChannelChart(%s, %s); });",
                    labels.toJSONString(), datasets.toJSONString());

            log.info("Sending Channel Chart JS Call");
            Clients.evalJavaScript(jsCall);

        } catch (Exception e) {
            log.severe("DailyReport Error: " + e.getMessage());
        } finally {
            DB.close(rs, pstmt);
        }
    }
}
