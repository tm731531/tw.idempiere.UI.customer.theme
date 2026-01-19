package tw.idempiere.form;

import org.compiere.util.CLogger;
import org.adempiere.webui.component.Button;
import org.adempiere.webui.component.ConfirmPanel;
import org.adempiere.webui.component.Grid;
import org.adempiere.webui.component.GridFactory;
import org.adempiere.webui.component.Label;
import org.adempiere.webui.component.Grid;
import org.adempiere.webui.component.GridFactory;
import org.adempiere.webui.component.Label;
import org.zkoss.zul.Row;
import org.zkoss.zul.Rows;
import org.adempiere.webui.component.Window;
import org.adempiere.webui.editor.WSearchEditor;
import org.adempiere.webui.event.DialogEvents;
import org.adempiere.webui.event.ValueChangeEvent;
import org.adempiere.webui.event.ValueChangeListener;
import org.adempiere.webui.theme.ThemeManager;
import org.compiere.model.MAttributeSetInstance;
import org.compiere.model.MColumn;
import org.compiere.model.MLookup;
import org.compiere.model.MLookupFactory;
import org.compiere.model.MTable;
import org.compiere.util.CLogger;
import org.compiere.util.DB;
import org.compiere.util.DisplayType;
import org.compiere.util.Env;
import org.compiere.util.Msg;
import org.compiere.wf.MWFNode;
import org.eevolution.model.X_PP_WF_Node_Asset;
import org.zkoss.zk.ui.event.Event;
import org.zkoss.zk.ui.event.EventListener;
import org.zkoss.zk.ui.event.Events;
import org.zkoss.zul.Borderlayout;
import org.zkoss.zul.Center;
import org.zkoss.zul.Hbox;
import org.zkoss.zul.Separator;
import org.zkoss.zul.Vbox;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.logging.Level;

public class WResourceDialog extends Window implements EventListener<Event>, ValueChangeListener {
    private static final long serialVersionUID = 1L;
    private static CLogger log = CLogger.getCLogger(WResourceDialog.class);

    private MWFNode m_node;
    private Grid m_grid;
    private WSearchEditor m_assetEditor;
    private ConfirmPanel m_confirmPanel;

    public WResourceDialog(MWFNode node) {
        m_node = node;
        init();
    }

    private void init() {
        setTitle("Assign Tools/Assets to: " + m_node.getName());
        setBorder("normal");
        setWidth("600px");
        setHeight("400px");
        setClosable(true);

        Borderlayout mainLayout = new Borderlayout();
        this.appendChild(mainLayout);

        // Top: Add Asset
        Vbox topBox = new Vbox();
        topBox.setStyle("padding: 10px");
        Hbox inputLine = new Hbox();
        inputLine.setAlign("center");
        inputLine.appendChild(new Label("Add Asset: "));

        // Search Editor for A_Asset
        int columnID = MColumn.getColumn_ID("A_Asset", "A_Asset_ID");
        MLookup lookup = null;
        try {
            lookup = MLookupFactory.get(Env.getCtx(), 0, columnID, DisplayType.Search,
                    Env.getLanguage(Env.getCtx()), "A_Asset_ID", 0, false, "IsActive='Y'");
        } catch (Exception e) {
            log.log(Level.SEVERE, "Failed to create lookup", e);
        }

        if (lookup != null) {
            m_assetEditor = new WSearchEditor("A_Asset_ID", true, false, true, lookup);
            m_assetEditor.addValueChangeListener(this);
            inputLine.appendChild(m_assetEditor.getComponent());
        }

        topBox.appendChild(inputLine);
        topBox.appendChild(new Separator());

        org.zkoss.zul.North north = new org.zkoss.zul.North();
        north.appendChild(topBox);
        mainLayout.appendChild(north);

        // Center: List
        m_grid = GridFactory.newGridLayout();
        Center center = new Center();
        center.setAutoscroll(true);
        center.appendChild(m_grid);
        mainLayout.appendChild(center);

        refreshGrid();

        // South: OK
        org.zkoss.zul.South south = new org.zkoss.zul.South();
        m_confirmPanel = new ConfirmPanel(true); // OK only
        m_confirmPanel.getButton(ConfirmPanel.A_OK).addEventListener(Events.ON_CLICK, this);
        m_confirmPanel.getButton(ConfirmPanel.A_CANCEL).setVisible(false);
        south.appendChild(m_confirmPanel);
        mainLayout.appendChild(south);

        this.addEventListener(DialogEvents.ON_WINDOW_CLOSE, this);
    }

    private void refreshGrid() {
        Rows rows = m_grid.getRows();
        if (rows == null) {
            rows = new Rows();
            m_grid.appendChild(rows);
        }
        rows.getChildren().clear();

        // Header
        Row header = new Row();
        header.setStyle("background-color: #F0F0F0; font-weight: bold;");
        header.appendChild(new Label("Asset / Tool"));
        header.appendChild(new Label("Action"));
        rows.appendChild(header);

        // Load Data
        String sql = "SELECT p.PP_WF_Node_Asset_ID, a.Name " +
                "FROM PP_WF_Node_Asset p " +
                "INNER JOIN A_Asset a ON (p.A_Asset_ID = a.A_Asset_ID) " +
                "WHERE p.AD_WF_Node_ID = ? AND p.IsActive='Y'";

        PreparedStatement pstmt = null;
        ResultSet rs = null;
        try {
            pstmt = DB.prepareStatement(sql, null);
            pstmt.setInt(1, m_node.getAD_WF_Node_ID());
            rs = pstmt.executeQuery();
            while (rs.next()) {
                final int id = rs.getInt(1);
                String name = rs.getString(2);

                Row row = new Row();
                row.appendChild(new Label(name));

                Button delBtn = new Button();
                if (ThemeManager.isUseFontIconForImage())
                    delBtn.setIconSclass("z-icon-Delete");
                else
                    delBtn.setImage(ThemeManager.getThemeResource("images/Delete16.png"));

                delBtn.setTooltiptext("Delete");
                delBtn.addEventListener(Events.ON_CLICK, new EventListener<Event>() {
                    public void onEvent(Event event) {
                        deleteAsset(id);
                    }
                });
                row.appendChild(delBtn);

                rows.appendChild(row);
            }
        } catch (Exception e) {
            log.log(Level.SEVERE, sql, e);
        } finally {
            DB.close(rs, pstmt);
        }
    }

    private void deleteAsset(int pp_WF_Node_Asset_ID) {
        X_PP_WF_Node_Asset record = new X_PP_WF_Node_Asset(Env.getCtx(), pp_WF_Node_Asset_ID, null);
        if (record.delete(true)) {
            refreshGrid();
        } else {
            // Show error?
        }
    }

    public void show() {
        this.doHighlighted();
    }

    @Override
    public void valueChange(ValueChangeEvent evt) {
        if (evt.getPropertyName().equals("A_Asset_ID")) {
            Object value = evt.getNewValue();
            if (value != null && value instanceof Integer) {
                int assetId = (Integer) value;
                createNodeAsset(assetId);
                m_assetEditor.setValue(null); // Clear
                refreshGrid();
            }
        }
    }

    private void createNodeAsset(int assetId) {
        X_PP_WF_Node_Asset record = new X_PP_WF_Node_Asset(Env.getCtx(), 0, null);
        record.setAD_WF_Node_ID(m_node.getAD_WF_Node_ID());
        record.setA_Asset_ID(assetId);
        record.saveEx();
    }

    @Override
    public void onEvent(Event event) throws Exception {
        if (event.getTarget() == m_confirmPanel.getButton(ConfirmPanel.A_OK)) {
            this.onClose();
        } else if (event.getName().equals(DialogEvents.ON_WINDOW_CLOSE)) {
            // Clean up if needed
        }
    }
}
