package tw.idempiere.form;

import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.logging.Level;
import org.adempiere.webui.window.FDialog;
import org.adempiere.webui.apps.AEnv;
import org.adempiere.webui.apps.wf.WFNodeContainer;
import org.adempiere.webui.apps.wf.WFPopupItem;
import org.adempiere.webui.component.ConfirmPanel;
import org.adempiere.webui.component.ListItem;
import org.adempiere.webui.component.Listbox;
import org.adempiere.webui.component.ListboxFactory;
import org.adempiere.webui.component.Textbox;
import org.adempiere.webui.component.ToolBar;
import org.adempiere.webui.component.Window;
import org.adempiere.webui.event.DialogEvents;
import org.adempiere.webui.panel.ADForm;
import org.adempiere.webui.theme.ThemeManager;
import org.adempiere.webui.util.ZKUpdateUtil;
import org.compiere.util.CLogger;
import org.compiere.apps.wf.WFGraphLayout;
import org.compiere.apps.wf.WFNodeWidget;
import org.compiere.model.MEntityType;
import org.compiere.model.MSysConfig;
import org.compiere.model.X_AD_Workflow;
import org.compiere.util.DB;
import org.compiere.util.Env;
import org.compiere.util.KeyNamePair;
import org.compiere.util.Msg;
import org.compiere.util.Util;
import org.compiere.util.NamePair;
import org.compiere.util.ValueNamePair;
import org.compiere.model.MRefList;
import org.compiere.wf.MWFNode;
import org.compiere.wf.MWFNodeNext;
import org.compiere.wf.MWorkflow;
import org.zkoss.zhtml.Table;
import org.zkoss.zhtml.Td;
import org.zkoss.zhtml.Tr;
import org.zkoss.zk.ui.Component;
import org.zkoss.zk.ui.event.DropEvent;
import org.zkoss.zk.ui.event.Event;
import org.zkoss.zk.ui.event.EventListener;
import org.zkoss.zk.ui.event.Events;
import org.zkoss.zul.Borderlayout;
import org.zkoss.zul.Center;
import org.zkoss.zul.Div;
import org.zkoss.zul.Hbox;
import org.zkoss.zul.Label;
import org.zkoss.zul.Menuitem;
import org.zkoss.zul.Menupopup;
import org.zkoss.zul.Menuseparator;
import org.zkoss.zul.North;
import org.zkoss.zul.Separator;
import org.zkoss.zul.South;
import org.zkoss.zul.Space;
import org.zkoss.zul.Toolbarbutton;
import org.zkoss.zul.Vbox;
import org.zkoss.zul.Intbox; // Added for Grid Column Control
import org.compiere.util.CLogger;

/**
 * Manufacturing Workflow Editor Custom implementation for Garment/Manufacturing
 * Workflows
 */
public class WFPanelTaiwan extends ADForm {
	private static final long serialVersionUID = 1L;
	private static CLogger log = CLogger.getCLogger(WFPanelTaiwan.class);

	/** Workflows dropdown list */
	private Listbox workflowList;
	private int m_workflowId = 0;
	private Toolbarbutton autoLayoutButton;
	private Toolbarbutton zoomButton;
	private Toolbarbutton refreshButton;
	private Toolbarbutton newButton;
	private Intbox gridColumnInput; // Input for Grid Columns
	/** Content of {@link #center} */
	private Table table;
	/** Center of form */
	private Center center;
	private MWorkflow m_wf;
	private WFNodeContainer nodeContainer;

	/**
	 * Layout form
	 */
	@Override
	protected void initForm() {
		ZKUpdateUtil.setHeight(this, "100%");

		// ... (existing code top) ...

		Borderlayout layout = new Borderlayout();
		layout.setStyle("width: 100%; height: 100%; position: relative;");
		appendChild(layout);

		// Custom filter for Manufacturing Workflows
		workflowList = ListboxFactory.newDropdownListbox();

		// Fill Workflow List - Filter by Manufacturing
		String sql = "SELECT AD_Workflow_ID, Name FROM AD_Workflow "
				+ "WHERE (AD_Client_ID=? OR AD_Client_ID=0) AND IsActive='Y' "
				+ "ORDER BY Name";

		java.sql.PreparedStatement pstmt = null;
		java.sql.ResultSet rs = null;
		try {
			pstmt = DB.prepareStatement(sql, null);
			pstmt.setInt(1, Env.getAD_Client_ID(Env.getCtx()));
			rs = pstmt.executeQuery();
			while (rs.next()) {
				int id = rs.getInt(1);
				String name = rs.getString(2);
				workflowList.addItem(new KeyNamePair(id, name));
			}
		} catch (Exception e) {
			log.log(Level.SEVERE, sql, e);
		} finally {
			DB.close(rs, pstmt);
		}

		workflowList.addEventListener(Events.ON_SELECT, this);

		createTable();
		center = new Center();
		layout.appendChild(center);
		center.setAutoscroll(true);
		center.appendChild(table);

		// Auto-select first item if available (Moved after table creation to avoid NPE)
		if (workflowList.getItemCount() > 0) {
			workflowList.setSelectedIndex(0);
			ListItem item = workflowList.getSelectedItem();
			KeyNamePair knp = item != null ? item.toKeyNamePair() : null;
			if (knp != null && knp.getKey() > 0) {
				load(knp.getKey(), true);
			}
		}

		North north = new North();
		layout.appendChild(north);
		ToolBar toolbar = new ToolBar();
		north.appendChild(toolbar);
		toolbar.appendChild(workflowList);

		// Zoom
		zoomButton = new Toolbarbutton();
		if (ThemeManager.isUseFontIconForImage())
			zoomButton.setIconSclass("z-icon-Zoom");
		else
			zoomButton.setImage(ThemeManager.getThemeResource("images/Zoom16.png"));
		toolbar.appendChild(zoomButton);
		zoomButton.addEventListener(Events.ON_CLICK, this);
		zoomButton.setTooltiptext(Util.cleanAmp(Msg.getMsg(Env.getCtx(), "Zoom")));

		// New Operation (Node)
		newButton = new Toolbarbutton();
		if (ThemeManager.isUseFontIconForImage())
			newButton.setIconSclass("z-icon-New");
		else
			newButton.setImage(ThemeManager.getThemeResource("images/New16.png"));
		toolbar.appendChild(newButton);
		newButton.addEventListener(Events.ON_CLICK, this);
		newButton.setTooltiptext("New Operation");

		// Auto Layout
		autoLayoutButton = new Toolbarbutton();
		if (ThemeManager.isUseFontIconForImage())
			autoLayoutButton.setIconSclass("z-icon-Process"); // Use Process icon as proxy for Layout
		else
			autoLayoutButton.setImage(ThemeManager.getThemeResource("images/Process16.png"));
		toolbar.appendChild(autoLayoutButton);
		autoLayoutButton.addEventListener(Events.ON_CLICK, this);
		autoLayoutButton.setTooltiptext("Auto Layout");

		// Refresh
		refreshButton = new Toolbarbutton();
		if (ThemeManager.isUseFontIconForImage())
			refreshButton.setIconSclass("z-icon-Refresh");
		else
			refreshButton.setImage(ThemeManager.getThemeResource("images/Refresh16.png"));
		toolbar.appendChild(refreshButton);
		refreshButton.addEventListener(Events.ON_CLICK, this);
		refreshButton.setTooltiptext(Util.cleanAmp(Msg.getMsg(Env.getCtx(), "Refresh")));

		toolbar.appendChild(new Space());
		toolbar.appendChild(new Label("Cols:"));
		gridColumnInput = new Intbox(4);
		gridColumnInput.setTooltiptext("Grid Columns");
		gridColumnInput.addEventListener(Events.ON_CHANGE, this);
		toolbar.appendChild(gridColumnInput);

		ZKUpdateUtil.setHeight(north, "30px");

		// -- WEST: Node Actions Library --
		org.zkoss.zul.West west = new org.zkoss.zul.West();
		west.setWidth("200px");
		west.setTitle("Node Actions");
		west.setCollapsible(true);
		west.setSplittable(true);
		layout.appendChild(west);

		Listbox opList = new Listbox();
		west.appendChild(opList);

		// Load Node Actions from AD_Reference_ID=302 (AD_WF_Node Action)
		ValueNamePair[] actions = MRefList.getList(Env.getCtx(), 302, false);
		for (ValueNamePair vp : actions) {
			ListItem li = new ListItem();
			li.setLabel(vp.getName());
			li.setDraggable("WFNode"); // Valid ID for dragging
			li.setValue(vp.getValue()); // Action Code (e.g. 'U', 'W')
			opList.appendChild(li);
		}
		// -------------------------------

		ConfirmPanel confirmPanel = new ConfirmPanel(true);
		confirmPanel.addActionListener(this);
		South south = new South();
		layout.appendChild(south);
		south.appendChild(confirmPanel);
		ZKUpdateUtil.setHeight(south, "36px");
	}

	/**
	 * Create {@link #table}
	 */
	private void createTable() {
		table = new Table();
		table.setDynamicProperty("cellpadding", "0");
		table.setDynamicProperty("cellspacing", "0");
		table.setDynamicProperty("border", "none");
		table.setStyle("margin:0;padding:0");
	}

	public void reload(int workflowId, boolean reread) {
		center.removeChild(table);
		createTable();
		center.appendChild(table);
		load(workflowId, reread);
	}

	@Override
	public void onEvent(Event event) throws Exception {
		super.onEvent(event);

		if (event.getTarget().getId().equals(ConfirmPanel.A_CANCEL))
			this.detach();
		else if (event.getTarget().getId().equals(ConfirmPanel.A_OK))
			this.detach();
		else if (event.getTarget() == workflowList) {
			center.removeChild(table);
			createTable();
			center.appendChild(table);
			ListItem item = workflowList.getSelectedItem();
			KeyNamePair knp = item != null ? item.toKeyNamePair() : null;
			if (knp != null && knp.getKey() > 0) {
				load(knp.getKey(), true);
			}
		} else if (event.getTarget() == zoomButton) {
			if (workflowList.getSelectedIndex() > -1)
				zoom();
		} else if (event.getTarget() == refreshButton) {
			if (workflowList.getSelectedIndex() > -1 && m_workflowId > 0)
				reload(m_workflowId, true);
		} else if (event.getTarget() == newButton) {
			if (workflowList.getSelectedIndex() > -1 && m_workflowId > 0)
				createNewNode();
		} else if (event.getTarget() == gridColumnInput) {
			if (m_wf != null) {
				int cols = gridColumnInput.getValue() != null ? gridColumnInput.getValue() : 4;
				if (cols < 1)
					cols = 4;
				// m_wf.set_Value("GridColumns", cols); // set_Value is protected in some
				// versions
				String updateSql = "UPDATE AD_Workflow SET GridColumns=" + cols + " WHERE AD_Workflow_ID="
						+ m_wf.getAD_Workflow_ID();
				DB.executeUpdate(updateSql, m_wf.get_TrxName());

				// Reload object to reflect changes if needed, but we used SQL update
				// m_wf.saveEx(); // Not needed if we used SQL update
				reload(m_workflowId, true);
			}
		} else if (event.getTarget() == autoLayoutButton) {
			if (workflowList.getSelectedIndex() > -1 && m_workflowId > 0)
				autoLayout();
		} else if (event.getTarget() instanceof Menuitem
				&& (((Menuitem) event.getTarget()).getAttribute("MWFNode") != null
						|| ((Menuitem) event.getTarget()).getAttribute("MWFNodeNext") != null)) {
			executePopupAction((Menuitem) event.getTarget());
		} else if (event.getName().equals(Events.ON_DROP)) {
			DropEvent dropEvent = (DropEvent) event;
			Component dragged = dropEvent.getDragged();
			Component target = event.getTarget();

			if (dragged instanceof ListItem) {
				// Handle Node Action Drop
				String actionCode = (String) ((ListItem) dragged).getValue(); // 'U', 'W', etc.
				String actionName = ((ListItem) dragged).getLabel();

				Integer targetNodeID = (Integer) target.getAttribute("AD_WF_Node_ID");
				if (targetNodeID != null && actionCode != null) {
					// Drop on Existing Node -> Insert Logic
					insertActionOnNode(actionCode, actionName, targetNodeID);
				} else {
					// Drop on Empty Space -> Create Logic
					Integer xPosition = (Integer) target.getAttribute("Node.XPosition");
					Integer yPosition = (Integer) target.getAttribute("Node.YPosition");

					if (actionCode != null && m_wf != null && xPosition != null && yPosition != null) {
						int AD_Client_ID = Env.getAD_Client_ID(Env.getCtx());
						MWFNode node = new MWFNode(m_wf, actionName, actionName); // Name, Value
						node.setAction(actionCode);
						setupNodeDefaults(node, actionCode);

						node.setClientOrg(AD_Client_ID, 0);
						if (AD_Client_ID > 11)
							node.setEntityType(MSysConfig.getValue(MSysConfig.DEFAULT_ENTITYTYPE,
									MEntityType.ENTITYTYPE_UserMaintained));

						node.setXPosition(xPosition);
						node.setYPosition(yPosition);
						node.saveEx();
						reload(m_workflowId, true);
					}
				}
			} else {
				// Existing Node Move Logic
				Integer AD_WF_Node_ID = (Integer) dropEvent.getDragged().getAttribute("AD_WF_Node_ID");
				Integer xPosition = (Integer) target.getAttribute("Node.XPosition");
				Integer yPosition = (Integer) target.getAttribute("Node.YPosition");

				log.warning("ON_DROP: DraggedID=" + AD_WF_Node_ID + ", Target X=" + xPosition + ", Target Y="
						+ yPosition + ", Target=" + target);

				if (AD_WF_Node_ID != null && xPosition != null && yPosition != null) {
					WFNodeWidget widget = (WFNodeWidget) nodeContainer.getGraphScene().findWidget(AD_WF_Node_ID);
					if (widget != null) {
						MWFNode node = widget.getModel();
						log.warning("ON_DROP: Node Found=" + node + ", ClientID=" + node.getAD_Client_ID()
								+ ", EnvClient=" + Env.getAD_Client_ID(Env.getCtx()));
						if (node.getAD_Client_ID() == Env.getAD_Client_ID(Env.getCtx())) {
							node.setXPosition(xPosition);
							node.setYPosition(yPosition);
							node.saveEx();
							reload(m_workflowId, true);
						} else {
							log.warning("ON_DROP: Client mismatch. Move ignored.");
						}
					} else {
						log.warning("ON_DROP: Widget not found for ID " + AD_WF_Node_ID);
					}
				} else {
					log.warning("ON_DROP: Missing attributes. X or Y or ID is null.");
				}
			}
		}
	}

	private void insertActionOnNode(String actionCode, String actionName, int targetNodeID) {
		// Use constructor to ensure mutable instance and avoid cache immutability
		MWFNode targetNode = new MWFNode(Env.getCtx(), targetNodeID, null);
		if (targetNode.get_ID() == 0)
			return;

		int AD_Client_ID = Env.getAD_Client_ID(Env.getCtx());

		// 1. Create New Node
		MWFNode newNode = new MWFNode(m_wf, actionName, actionName); // Name, Value
		newNode.setAction(actionCode);
		setupNodeDefaults(newNode, actionCode);

		newNode.setClientOrg(AD_Client_ID, 0);
		if (AD_Client_ID > 11)
			newNode.setEntityType(
					MSysConfig.getValue(MSysConfig.DEFAULT_ENTITYTYPE, MEntityType.ENTITYTYPE_UserMaintained));

		// Calculate Position (Between Target and Successors)
		MWFNodeNext[] transitions = targetNode.getTransitions(AD_Client_ID);
		List<MWFNode> successors = new ArrayList<MWFNode>();

		for (MWFNodeNext t : transitions) {
			MWFNode next = MWFNode.get(Env.getCtx(), t.getAD_WF_Next_ID());
			if (next != null) {
				successors.add(next);
			}
		}

		int newX = targetNode.getXPosition();
		int newY = targetNode.getYPosition();

		if (successors.size() > 0) {
			// Average position of successors
			int sumX = 0;
			int sumY = 0;
			for (MWFNode s : successors) {
				sumX += s.getXPosition();
				sumY += s.getYPosition();
			}
			int avgX = sumX / successors.size();
			int avgY = sumY / successors.size();

			newX = (targetNode.getXPosition() + avgX) / 2;
			newY = (targetNode.getYPosition() + avgY) / 2;
		} else {
			// No Outgoing: Place slightly right/down
			newX = newX + 2;
		}

		// Avoid overlap (simple check)
		while (isPositionOccupied(newX, newY)) {
			// If blocked, just move down
			newY++;
		}

		newNode.setXPosition(newX);
		newNode.setYPosition(newY);
		newNode.saveEx();

		// 2. Move Outgoing Transitions from Target to New Node
		// We want Target -> New -> Successors
		// So existing Target -> Successor links should become New -> Successor
		for (MWFNodeNext t : transitions) {
			// Create new link from NewNode -> Successor
			MWFNodeNext newNext = new MWFNodeNext(newNode, t.getAD_WF_Next_ID());
			newNext.setClientOrg(AD_Client_ID, 0);
			newNext.saveEx();

			// Delete old link Target -> Successor
			// MNodeNext might be immutable if from cache, so reload to delete
			MWFNodeNext toDelete = new MWFNodeNext(Env.getCtx(), t.get_ID(), null);
			toDelete.delete(true);
		}

		// 3. Create Transition Target -> New
		MWFNodeNext linkTargetToNew = new MWFNodeNext(targetNode, newNode.getAD_WF_Node_ID());
		linkTargetToNew.setClientOrg(AD_Client_ID, 0);
		linkTargetToNew.saveEx();

		reload(m_workflowId, true);
	}

	/**
	 * Auto-assign mandatory fields based on Action type to avoid "Fill Mandatory"
	 * errors.
	 */
	private void setupNodeDefaults(MWFNode node, String action) {
		if (action == null)
			return;

		// See MWFNode.beforeSave for validation logic
		if (MWFNode.ACTION_AppsProcess.equals(action) || MWFNode.ACTION_AppsReport.equals(action)) {
			// Default to first Process found
			int id = DB.getSQLValue(null, "SELECT AD_Process_ID FROM AD_Process WHERE IsActive='Y'");
			if (id > 0)
				node.setAD_Process_ID(id);
		} else if (MWFNode.ACTION_AppsTask.equals(action)) {
			int id = DB.getSQLValue(null, "SELECT AD_Task_ID FROM AD_Task WHERE IsActive='Y'");
			if (id > 0)
				node.setAD_Task_ID(id);
		} else if (MWFNode.ACTION_DocumentAction.equals(action)) {
			node.setDocAction("CO"); // Complete
		} else if (MWFNode.ACTION_EMail.equals(action)) {
			int id = DB.getSQLValue(null, "SELECT R_MailText_ID FROM R_MailText WHERE IsActive='Y'");
			if (id > 0)
				node.setR_MailText_ID(id);
		} else if (MWFNode.ACTION_SetVariable.equals(action)) {
			node.setAttributeValue("Default");
			// Ensure we set a column if possible (optional but good practice)
			int id = DB.getSQLValue(null, "SELECT AD_Column_ID FROM AD_Column WHERE IsActive='Y'");
			if (id > 0)
				node.setAD_Column_ID(id);
		} else if (MWFNode.ACTION_SubWorkflow.equals(action)) {
			int id = DB.getSQLValue(null,
					"SELECT AD_Workflow_ID FROM AD_Workflow WHERE IsActive='Y' AND AD_Workflow_ID != ?",
					m_workflowId);
			if (id > 0)
				node.setAD_Workflow_ID(id);
		} else if (MWFNode.ACTION_UserChoice.equals(action)) {
			int id = DB.getSQLValue(null, "SELECT AD_Column_ID FROM AD_Column WHERE IsActive='Y'");
			if (id > 0)
				node.setAD_Column_ID(id);
		} else if (MWFNode.ACTION_UserForm.equals(action)) {
			int id = DB.getSQLValue(null, "SELECT AD_Form_ID FROM AD_Form WHERE IsActive='Y'");
			if (id > 0)
				node.setAD_Form_ID(id);
		} else if (MWFNode.ACTION_UserWindow.equals(action)) {
			int id = DB.getSQLValue(null, "SELECT AD_Window_ID FROM AD_Window WHERE IsActive='Y'");
			if (id > 0)
				node.setAD_Window_ID(id);
		} else if (MWFNode.ACTION_UserInfo.equals(action)) {
			int id = DB.getSQLValue(null, "SELECT AD_InfoWindow_ID FROM AD_InfoWindow WHERE IsActive='Y'");
			if (id > 0)
				node.setAD_InfoWindow_ID(id);
		}
	}

	private void autoLayout() {
		if (m_wf == null)
			return;

		MWFNode[] nodes = m_wf.getNodes(false, Env.getAD_Client_ID(Env.getCtx()));
		if (nodes == null || nodes.length == 0)
			return;

		// Map NodeID -> Level
		Map<Integer, Integer> levels = new HashMap<Integer, Integer>();
		Map<Integer, MWFNode> nodeMap = new HashMap<Integer, MWFNode>();
		List<MWFNode> roots = new ArrayList<MWFNode>();

		for (MWFNode n : nodes) {
			nodeMap.put(n.getAD_WF_Node_ID(), n);
			levels.put(n.getAD_WF_Node_ID(), 0); // Default level 0
		}

		// Find explicit start node
		int startNodeId = m_wf.getAD_WF_Node_ID();
		MWFNode startNode = nodeMap.get(startNodeId);

		if (startNode != null) {
			roots.add(startNode);
		} else if (nodes.length > 0) {
			// Find nodes with no incoming edges if start node not defined/found
			// For now, simpler: just use first if no start node
			roots.add(nodes[0]);
		}

		// BFS to assign levels
		Queue<Integer> queue = new LinkedList<Integer>();
		if (startNode != null) {
			queue.add(startNodeId);
			levels.put(startNodeId, 0);
		}

		// Find unconnected components? Simple approach first:
		// Assume StartNode is root. Process.
		// Then iterate all nodes, if any level 0 but not start node and not visited,
		// process them?
		// Let's just process reachable from Start first.

		Set<Integer> visited = new HashSet<Integer>();

		// Add All "Potential Roots" (level 0 candidates)?
		// Actually, just relying on Start Node is safest for WF.

		while (!queue.isEmpty()) {
			int currentId = queue.poll();
			if (visited.contains(currentId))
				continue;
			visited.add(currentId);

			MWFNode current = nodeMap.get(currentId);
			int currentLevel = levels.get(currentId);

			MWFNodeNext[] transitions = current.getTransitions(Env.getAD_Client_ID(Env.getCtx()));
			for (MWFNodeNext t : transitions) {
				int nextId = t.getAD_WF_Next_ID();
				if (nodeMap.containsKey(nextId)) {
					int nextLevel = levels.get(nextId);
					if (nextLevel <= currentLevel) {
						levels.put(nextId, currentLevel + 1);
						queue.add(nextId);
					}
				}
			}
		}

		// Handle disconnected nodes (make them level 0 or handled separately)
		// We will just group by the levels calculated.

		Map<Integer, List<MWFNode>> nodesByLevel = new HashMap<Integer, List<MWFNode>>();
		int maxLevel = 0;

		for (MWFNode n : nodes) {
			int level = levels.containsKey(n.getAD_WF_Node_ID()) ? levels.get(n.getAD_WF_Node_ID()) : 0;
			if (!nodesByLevel.containsKey(level)) {
				nodesByLevel.put(level, new ArrayList<MWFNode>());
			}
			nodesByLevel.get(level).add(n);
			if (level > maxLevel)
				maxLevel = level;
		}

		// Assign Coordinates
		for (int l = 0; l <= maxLevel; l++) {
			List<MWFNode> levelNodes = nodesByLevel.get(l);
			if (levelNodes == null)
				continue;

			for (int i = 0; i < levelNodes.size(); i++) {
				MWFNode n = levelNodes.get(i);
				int x = l * 2 + 1; // Spaced out columns
				int y = i * 2 + 1; // Spaced out rows
				n.setXPosition(x);
				n.setYPosition(y);
				n.saveEx();
			}
		}

		reload(m_workflowId, true);
	}

	// executePopupAction is now implemented below showNodeMenu

	/**
	 * Load and render workflow nodes
	 */
	private void load(int workflowId, boolean reread) {
		m_wf = MWorkflow.getCopy(Env.getCtx(), workflowId, (String) null);
		m_workflowId = workflowId;
		nodeContainer = new WFNodeContainer();
		nodeContainer.setWorkflow(m_wf);

		// Get configured Grid Columns explicitly from DB
		int gridCols = 4;
		int val = DB.getSQLValue(null, "SELECT GridColumns FROM AD_Workflow WHERE AD_Workflow_ID=?", workflowId);

		if (val > 0)
			gridCols = val;

		// Use Reflection to override private noOfColumns in WFNodeContainer (Core Code)
		// MUST happen before adding nodes!
		try {
			java.lang.reflect.Field f = nodeContainer.getClass().getDeclaredField("noOfColumns");
			f.setAccessible(true);
			f.setInt(nodeContainer, gridCols);
		} catch (Exception e) {
			log.log(Level.SEVERE, "Failed to set noOfColumns via reflection", e);
		}

		// Ensure input reflects current value
		if (gridColumnInput != null)
			gridColumnInput.setValue(gridCols);

		if (reread) {
			m_wf.reloadNodes();
		}

		MWFNode[] nodes = m_wf.getNodes(true, Env.getAD_Client_ID(Env.getCtx()));
		List<Integer> added = new ArrayList<Integer>();
		for (int i = 0; i < nodes.length; i++) {
			if (!added.contains(nodes[i].getAD_WF_Node_ID()))
				nodeContainer.addNode(nodes[i]);
		}

		for (int i = 0; i < nodes.length; i++) {
			MWFNodeNext[] nexts = nodes[i].getTransitions(Env.getAD_Client_ID(Env.getCtx()));
			for (int j = 0; j < nexts.length; j++) {
				nodeContainer.addEdge(nexts[j]);
			}
		}

		// Ensure input reflects current value
		if (gridColumnInput != null)
			gridColumnInput.setValue(gridCols);

		Dimension dimension = nodeContainer.getDimension();
		int row = nodeContainer.getRowCount();

		// Ensure Bitmap is large enough for the Grid
		int width = Math.max(dimension.width, gridCols * WFGraphLayout.COLUMN_WIDTH);
		int height = Math.max(dimension.height, (row + 1) * WFGraphLayout.ROW_HEIGHT);

		BufferedImage bi = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
		Graphics2D graphics = bi.createGraphics();
		nodeContainer.validate(graphics);
		nodeContainer.paint(graphics);

		try {
			// Ensure we have enough columns to show all nodes if maxCol > configured?
			// User requirement says "adjust grid to specified", implies hard limit/view.
			// However, if nodes are outside, they are hidden. User might increase col to
			// see them.

			for (int i = 0; i < row + 1; i++) {
				Tr tr = new Tr();
				table.appendChild(tr);
				for (int c = 0; c < gridCols; c++) {
					BufferedImage t = new BufferedImage(WFGraphLayout.COLUMN_WIDTH, WFGraphLayout.ROW_HEIGHT,
							BufferedImage.TYPE_INT_ARGB);
					Graphics2D tg = t.createGraphics();
					Td td = new Td();
					// Use CSS for dimensions since Td doesn't support setWidth directly in this
					// version
					td.setStyle("border: 1px dotted lightgray; width:" + WFGraphLayout.COLUMN_WIDTH + "px; height:"
							+ WFGraphLayout.ROW_HEIGHT + "px;");
					tr.appendChild(td);

					// Always create content for the cell, even if empty or last row
					int x = c * WFGraphLayout.COLUMN_WIDTH;
					int y = i * WFGraphLayout.ROW_HEIGHT;

					// Check Bounds before drawing
					if (x + WFGraphLayout.COLUMN_WIDTH <= bi.getWidth()
							&& y + WFGraphLayout.ROW_HEIGHT <= bi.getHeight()) {
						tg.drawImage(bi.getSubimage(x, y, WFGraphLayout.COLUMN_WIDTH, WFGraphLayout.ROW_HEIGHT), 0, 0,
								null);
					}

					org.zkoss.zul.Image image = new org.zkoss.zul.Image();
					image.setWidth(WFGraphLayout.COLUMN_WIDTH + "px");
					image.setHeight(WFGraphLayout.ROW_HEIGHT + "px");

					try {
						java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
						javax.imageio.ImageIO.write(t, "png", baos);
						image.setContent(new org.zkoss.image.AImage("node", baos.toByteArray()));
					} catch (java.io.IOException e) {
						log.log(Level.SEVERE, "Failed to create AImage", e);
					}
					td.appendChild(image);
					String imgStyle = "border:none;margin:0;padding:0";

					// Check for Node Widget in this logical position
					WFNodeWidget widget = null;
					if (i < row) {
						widget = nodeContainer.findWidget(i + 1, c + 1);
					}

					image.setAttribute("Node.XPosition", c + 1);
					image.setAttribute("Node.YPosition", i + 1);

					if (widget != null) {
						MWFNode node = widget.getModel();
						if (node.getHelp(true) != null) {
							image.setTooltiptext(node.getHelp(true));
						}
						image.setAttribute("AD_WF_Node_ID", node.getAD_WF_Node_ID());
						image.addEventListener(Events.ON_CLICK, new EventListener<Event>() {
							public void onEvent(Event event) throws Exception {
								showNodeMenu(event.getTarget());
							}
						});
						image.setDraggable("WFNode");
						image.setDroppable("WFNode"); // Allow dropping onto node
						image.addEventListener(Events.ON_DROP, this);
						imgStyle = imgStyle + ";cursor:pointer";
					} else {
						// Empty Cell (or new row/col) - Just Droppable
						image.setDroppable("WFNode");
						image.addEventListener(Events.ON_DROP, this);
					}
					image.setStyle(imgStyle);

					tg.dispose();
				}
			}

		} catch (Exception e) {
			log.log(Level.SEVERE, e.getLocalizedMessage(), e);
		}
	}

	protected void showNodeMenu(Component target) {
		Integer AD_WF_Node_ID = (Integer) target.getAttribute("AD_WF_Node_ID");
		if (AD_WF_Node_ID != null) {
			WFNodeWidget widget = (WFNodeWidget) nodeContainer.getGraphScene().findWidget(AD_WF_Node_ID);
			if (widget != null) {
				final MWFNode node = widget.getModel();
				Menupopup popupMenu = new Menupopup();

				// -- Assign Resources (Garment Feature) - Commented out for General Purpose
				/*
				 * Menuitem resourceItem = new Menuitem("Assign Resources (Tools)");
				 * resourceItem.setImage(ThemeManager.getThemeResource("images/Attachment16.png"
				 * ));
				 * resourceItem.addEventListener(Events.ON_CLICK, new EventListener<Event>() {
				 * public void onEvent(Event event) {
				 * new WResourceDialog(node).show();
				 * }
				 * });
				 * popupMenu.appendChild(resourceItem);
				 */

				// Clone Node (Garment Feature)
				Menuitem cloneItem = new Menuitem(Msg.getMsg(Env.getCtx(), "Copy"));
				cloneItem.setImage(ThemeManager.getThemeResource("images/Copy16.png"));
				cloneItem.addEventListener(Events.ON_CLICK, new EventListener<Event>() {
					public void onEvent(Event event) {
						cloneNode(node);
					}
				});
				popupMenu.appendChild(cloneItem);

				popupMenu.appendChild(new Menuseparator());

				// -- Standard Actions --

				// Zoom
				addMenuItem(popupMenu, Util.cleanAmp(Msg.getMsg(Env.getCtx(), "Zoom")), node,
						WFPopupItem.WFPOPUPITEM_ZOOM);

				if (node.getAD_Client_ID() == Env.getAD_Client_ID(Env.getCtx())) {
					// Properties
					addMenuItem(popupMenu, Msg.getMsg(Env.getCtx(), "Properties"), node,
							WFPopupItem.WFPOPUPITEM_PROPERTIES);

					// Delete Node
					String title = Msg.getMsg(Env.getCtx(), "DeleteNode") + ": " + node.getName(true);
					addMenuItem(popupMenu, title, node, WFPopupItem.WFPOPUPITEM_DELETENODE);
				}

				// Lines (Transitions)
				MWFNode[] nodes = m_wf.getNodes(true, Env.getAD_Client_ID(Env.getCtx()));
				MWFNodeNext[] lines = node.getTransitions(Env.getAD_Client_ID(Env.getCtx()));

				// Add New Line
				for (MWFNode nn : nodes) {
					if (nn.getAD_WF_Node_ID() == node.getAD_WF_Node_ID())
						continue; // same
					if (nn.getAD_WF_Node_ID() == node.getAD_Workflow().getAD_WF_Node_ID())
						continue; // don't add line to starting node

					boolean found = false;
					for (MWFNodeNext line : lines) {
						if (nn.getAD_WF_Node_ID() == line.getAD_WF_Next_ID()) {
							found = true; // line already exists
							break;
						}
					}
					// Check inverse
					if (!found) {
						for (MWFNodeNext revline : nn.getTransitions(Env.getAD_Client_ID(Env.getCtx()))) {
							if (node.getAD_WF_Node_ID() == revline.getAD_WF_Next_ID()) {
								found = true; // inverse line already exists
								break;
							}
						}
					}

					if (!found) {
						String title = Msg.getMsg(Env.getCtx(), "AddLine") + ": " + node.getName(true) + " -> "
								+ nn.getName(true);
						addMenuItem(popupMenu, title, node, nn.getAD_WF_Node_ID());
					}
				}

				// Delete Lines & Insert Node
				for (MWFNodeNext line : lines) {
					if (line.getAD_Client_ID() != Env.getAD_Client_ID(Env.getCtx()))
						continue;
					MWFNode next = MWFNode.get(Env.getCtx(), line.getAD_WF_Next_ID());

					// Delete Line
					String deleteTitle = Msg.getMsg(Env.getCtx(), "DeleteLine") + ": " + node.getName(true) + " -> "
							+ next.getName(true);
					addMenuItem(popupMenu, deleteTitle, line);

					// Insert Node (Garment Feature)
					Menuitem insertItem = new Menuitem(
							"Insert Operation: " + node.getName(true) + " -> " + next.getName(true));
					insertItem.setImage(ThemeManager.getThemeResource("images/New16.png"));
					insertItem.setAttribute("MWFNodeNext", line);
					insertItem.setAttribute("IsInsert", true);
					insertItem.addEventListener(Events.ON_CLICK, this);
					popupMenu.appendChild(insertItem);
				}

				popupMenu.setPage(target.getPage());
				popupMenu.open(target);
			}
		}
	}

	private void addMenuItem(Menupopup menu, String title, MWFNode node, int AD_WF_NodeTo_ID) {
		Menuitem item = new Menuitem(title);
		item.setAttribute("MWFNode", node);
		item.setAttribute("AD_WF_NodeTo_ID", AD_WF_NodeTo_ID);
		menu.appendChild(item);
		item.addEventListener(Events.ON_CLICK, this);
	}

	private void addMenuItem(Menupopup menu, String title, MWFNodeNext line) {
		Menuitem item = new Menuitem(title);
		item.setAttribute("MWFNodeNext", line);
		// Default to Delete if IsInsert is not set
		menu.appendChild(item);
		item.addEventListener(Events.ON_CLICK, this);
	}

	private void executePopupAction(Menuitem item) {
		if (item.getAttribute("MWFNodeNext") != null) {
			MWFNodeNext line = (MWFNodeNext) item.getAttribute("MWFNodeNext");

			if (item.getAttribute("IsInsert") != null && (Boolean) item.getAttribute("IsInsert")) {
				// Insert Node
				insertNode(line);
			} else {
				// Delete Line
				line.delete(true);
				reload(m_workflowId, true);
			}
		} else {
			Integer AD_WF_NodeTo_ID = (Integer) item.getAttribute("AD_WF_NodeTo_ID");
			MWFNode node = (MWFNode) item.getAttribute("MWFNode");

			if (AD_WF_NodeTo_ID == null || node == null)
				return;

			if (AD_WF_NodeTo_ID == WFPopupItem.WFPOPUPITEM_ZOOM) {
				AEnv.zoom(MWFNode.Table_ID, node.getAD_WF_Node_ID());
			} else if (AD_WF_NodeTo_ID == WFPopupItem.WFPOPUPITEM_PROPERTIES) {
				editNode(node);
			} else if (AD_WF_NodeTo_ID == WFPopupItem.WFPOPUPITEM_DELETENODE) {
				// Delete Node
				if (node.delete(true)) {
					reload(m_workflowId, true);
				} else {
					FDialog.error(m_WindowNo, this, "DeleteError");
				}
			} else if (AD_WF_NodeTo_ID > 0) {
				// Add Line (Transition)
				MWFNodeNext next = new MWFNodeNext(node, AD_WF_NodeTo_ID);
				next.saveEx();
				reload(m_workflowId, true);
			}
		}
	}

	// Insert Node Logic
	private void insertNode(final MWFNodeNext transition) {
		String nameLabel = Msg.getElement(Env.getCtx(), MWFNode.COLUMNNAME_Name);
		String title = "Insert Operation";
		final Window w = new Window();
		w.setTitle(title);
		Vbox vbox = new Vbox();
		w.appendChild(vbox);
		vbox.appendChild(new Separator());
		Hbox hbox = new Hbox();
		hbox.appendChild(new Label(nameLabel));
		hbox.appendChild(new Space());
		final Textbox text = new Textbox();
		hbox.appendChild(text);
		vbox.appendChild(hbox);

		vbox.appendChild(new Separator());
		final ConfirmPanel panel = new ConfirmPanel(true, false, false, false, false, false, false);
		vbox.appendChild(panel);
		panel.addActionListener(Events.ON_CLICK, new EventListener<Event>() {
			public void onEvent(Event event) throws Exception {
				if (event.getTarget() == panel.getButton(ConfirmPanel.A_CANCEL)) {
					text.setText("");
				}
				w.onClose();
			}
		});

		w.setBorder("normal");
		w.setPage(this.getPage());
		w.addEventListener(DialogEvents.ON_WINDOW_CLOSE, new EventListener<Event>() {
			@Override
			public void onEvent(Event event) throws Exception {
				String name = text.getText();
				if (name != null && name.length() > 0) {
					MWFNode prevNode = new MWFNode(Env.getCtx(), transition.getAD_WF_Node_ID(), null);
					MWFNode nextNode = new MWFNode(Env.getCtx(), transition.getAD_WF_Next_ID(), null);

					int AD_Client_ID = Env.getAD_Client_ID(Env.getCtx());

					// 1. Create New Node
					MWFNode newNode = new MWFNode(m_wf, name, name);
					newNode.setClientOrg(AD_Client_ID, 0);
					if (AD_Client_ID > 11)
						newNode.setEntityType(MSysConfig.getValue(MSysConfig.DEFAULT_ENTITYTYPE,
								MEntityType.ENTITYTYPE_UserMaintained));

					// Position roughly between nodes
					int newX = (prevNode.getXPosition() + nextNode.getXPosition()) / 2;
					int newY = (prevNode.getYPosition() + nextNode.getYPosition()) / 2;

					// Ensure not exactly overlapping if straight vertical/horizontal
					if (newX == prevNode.getXPosition())
						newX += 1;
					if (newY == prevNode.getYPosition())
						newY += 1;

					while (isPositionOccupied(newX, newY)) {
						newY = newY + 1;
					}

					newNode.setXPosition(newX);
					newNode.setYPosition(newY);
					newNode.saveEx();

					// 2. Create Transition Prev -> New
					MWFNodeNext t1 = new MWFNodeNext(prevNode, newNode.getAD_WF_Node_ID());
					t1.saveEx();

					// 3. Create Transition New -> Next
					MWFNodeNext t2 = new MWFNodeNext(newNode, nextNode.getAD_WF_Node_ID());
					t2.saveEx();

					// 4. Delete Old Transition
					transition.delete(true);

					reload(m_wf.getAD_Workflow_ID(), true);
				}
			}
		});
		w.doHighlighted();
	}

	private void createNewNode() {
		String nameLabel = Msg.getElement(Env.getCtx(), MWFNode.COLUMNNAME_Name);
		String title = "Create New Operation";
		final Window w = new Window();
		w.setTitle(title);
		Vbox vbox = new Vbox();
		w.appendChild(vbox);
		vbox.appendChild(new Separator());
		Hbox hbox = new Hbox();
		hbox.appendChild(new Label(nameLabel));
		hbox.appendChild(new Space());
		final Textbox text = new Textbox();
		hbox.appendChild(text);
		vbox.appendChild(hbox);
		vbox.appendChild(new Separator());
		final ConfirmPanel panel = new ConfirmPanel(true, false, false, false, false, false, false);
		vbox.appendChild(panel);
		panel.addActionListener(Events.ON_CLICK, new EventListener<Event>() {
			public void onEvent(Event event) throws Exception {
				if (event.getTarget() == panel.getButton(ConfirmPanel.A_CANCEL)) {
					text.setText("");
				}
				w.onClose();
			}
		});

		w.setBorder("normal");
		w.setPage(this.getPage());
		w.addEventListener(DialogEvents.ON_WINDOW_CLOSE, new EventListener<Event>() {
			@Override
			public void onEvent(Event event) throws Exception {
				String name = text.getText();
				if (name != null && name.length() > 0) {
					int AD_Client_ID = Env.getAD_Client_ID(Env.getCtx());
					MWFNode node = new MWFNode(m_wf, name, name);
					node.setClientOrg(AD_Client_ID, 0);
					if (AD_Client_ID > 11)
						node.setEntityType(MSysConfig.getValue(MSysConfig.DEFAULT_ENTITYTYPE,
								MEntityType.ENTITYTYPE_UserMaintained));
					node.saveEx();
					reload(m_wf.getAD_Workflow_ID(), true);
				}
			}
		});
		w.doHighlighted();
	}

	private void cloneNode(MWFNode sourceNode) {
		String name = sourceNode.getName() + " (Copy)";
		MWFNode newNode = new MWFNode(m_wf, name, name);
		newNode.setDescription(sourceNode.getDescription());
		newNode.setClientOrg(sourceNode.getAD_Client_ID(), sourceNode.getAD_Org_ID());

		int x = sourceNode.getXPosition();
		int y = sourceNode.getYPosition();

		// Try placing to the right first
		x = x + 1;

		// If occupied, move down
		while (isPositionOccupied(x, y)) {
			y = y + 1;
		}

		newNode.setXPosition(x);
		newNode.setYPosition(y);
		newNode.setAction(sourceNode.getAction());
		newNode.setAD_Window_ID(sourceNode.getAD_Window_ID());
		newNode.setAD_Process_ID(sourceNode.getAD_Process_ID());
		newNode.setAD_Form_ID(sourceNode.getAD_Form_ID());
		newNode.saveEx();
		reload(m_workflowId, true);
	}

	private boolean isPositionOccupied(int x, int y) {
		MWFNode[] nodes = m_wf.getNodes(false, Env.getAD_Client_ID(Env.getCtx()));
		for (MWFNode node : nodes) {
			if (node.getXPosition() == x && node.getYPosition() == y) {
				return true;
			}
		}
		return false;
	}

	private void editNode(final MWFNode m_node) {
		String title = Msg.getMsg(Env.getCtx(), "Properties");
		final Window w = new Window();
		w.setTitle(title);
		Vbox vbox = new Vbox();
		w.appendChild(vbox);
		vbox.appendChild(new Separator());
		// Name
		String labelName = Msg.getElement(Env.getCtx(), MWFNode.COLUMNNAME_Name);
		Hbox hboxName = new Hbox();
		hboxName.appendChild(new Label(labelName));
		hboxName.appendChild(new Space());
		final Textbox textName = new Textbox(m_node.getName());
		hboxName.appendChild(textName);
		vbox.appendChild(hboxName);
		// Description
		String labelDescription = Msg.getElement(Env.getCtx(), MWFNode.COLUMNNAME_Description);
		Hbox hboxDescription = new Hbox();
		hboxDescription.appendChild(new Label(labelDescription));
		hboxDescription.appendChild(new Space());
		final Textbox textDescription = new Textbox(m_node.getDescription());
		hboxDescription.appendChild(textDescription);
		vbox.appendChild(hboxDescription);
		//
		vbox.appendChild(new Separator());
		final ConfirmPanel panel = new ConfirmPanel(true, false, false, false, false, false, false);
		vbox.appendChild(panel);
		panel.addActionListener(Events.ON_CLICK, new EventListener<Event>() {
			public void onEvent(Event event) throws Exception {
				if (event.getTarget() == panel.getButton(ConfirmPanel.A_CANCEL)) {
					textName.setText("");
				}
				w.onClose();
			}
		});

		w.setBorder("normal");
		w.setPage(this.getPage());
		w.addEventListener(DialogEvents.ON_WINDOW_CLOSE, new EventListener<Event>() {
			@Override
			public void onEvent(Event event) throws Exception {
				String name = textName.getText();
				if (name != null && name.length() > 0) {
					m_node.setName(name);
					m_node.setDescription(textDescription.getText());
					m_node.saveEx();
					reload(m_workflowId, true);
				}
			}
		});
		w.doHighlighted();
	}

	private void zoom() {
		if (m_workflowId > 0) {
			AEnv.zoom(MWorkflow.Table_ID, m_workflowId);
		}
	}
}
