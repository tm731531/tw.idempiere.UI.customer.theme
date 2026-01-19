package tw.idempiere.customer.forms;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import org.adempiere.webui.util.ZKUpdateUtil;
import org.compiere.util.CLogger;
import org.compiere.util.DB;
import org.compiere.util.Env;
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

    @Override
    public void doAfterCompose(Window comp) throws Exception {
        super.doAfterCompose(comp);
        log.info("DailyReportController composed");
        refreshData();
    }

    @Listen("onClick = #btnRefresh")
    public void onRefresh() {
        log.info("Refresh button clicked");
        refreshData();
    }

    private void refreshData() {
        List<String> labels = new ArrayList<>();
        List<Integer> salesData = new ArrayList<>();
        List<Integer> purchaseData = new ArrayList<>();

        int todaySales = 0;
        int todayPurchase = 0;

        // SQL for Daily Orders & Purchase Orders (Last 7 days)
        String sql = "SELECT date_trunc('day', DateOrdered) as day, " +
                "COUNT(CASE WHEN IsSOTrx='Y' THEN 1 END) as sales_count, " +
                "COUNT(CASE WHEN IsSOTrx='N' THEN 1 END) as purchase_count " +
                "FROM C_Order " +
                "WHERE AD_Client_ID=? " +
                "AND DateOrdered >= CURRENT_DATE - INTERVAL '7 days' " +
                "GROUP BY day ORDER BY day";

        PreparedStatement pstmt = null;
        ResultSet rs = null;
        try {
            int AD_Client_ID = Env.getAD_Client_ID(Env.getCtx());
            log.info("Refreshing data for Client: " + AD_Client_ID);

            pstmt = DB.prepareStatement(sql, null);
            pstmt.setInt(1, AD_Client_ID);
            rs = pstmt.executeQuery();
            while (rs.next()) {
                String dayStr = rs.getDate("day").toString();
                int sCount = rs.getInt("sales_count");
                int pCount = rs.getInt("purchase_count");

                labels.add("'" + dayStr + "'"); // Add quotes for JS
                salesData.add(sCount);
                purchaseData.add(pCount);
            }

            log.info("Data fetched. Rows: " + labels.size());

            if (!salesData.isEmpty()) {
                todaySales = salesData.get(salesData.size() - 1);
                todayPurchase = purchaseData.get(purchaseData.size() - 1);
            }

            if (lblSalesToday != null)
                lblSalesToday.setValue(String.valueOf(todaySales));
            if (lblPurchaseToday != null)
                lblPurchaseToday.setValue(String.valueOf(todayPurchase));

            // Push data to Chart.js
            // We'll use the ZUL ID '$chartDiv' directly in the JS function for reliability
            String jsCall = String.format("zk.afterMount(function(){ renderDailyChart(%s, %s, %s); });",
                    labels.toString(), salesData.toString(), purchaseData.toString());

            log.info("Sending Chart JS Call");
            Clients.evalJavaScript(jsCall);

        } catch (Exception e) {
            log.severe("DailyReport Error: " + e.getMessage());
            Clients.showNotification("Error: " + e.getMessage(), "error", null, "middle_center", 5000);
        } finally {
            DB.close(rs, pstmt);
        }
    }
}
