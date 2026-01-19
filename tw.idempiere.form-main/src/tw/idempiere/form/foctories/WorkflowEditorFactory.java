package tw.idempiere.form.foctories;

import org.adempiere.webui.factory.IFormFactory;
import org.adempiere.webui.panel.ADForm;

import tw.idempiere.form.WFPanelTaiwan;

public class WorkflowEditorFactory implements IFormFactory {

	public WorkflowEditorFactory() {
	}

	@Override
	public ADForm newFormInstance(String formName) {
		if (formName.equals("tw.idempiere.form.WFPanelTaiwan")) {
			return new WFPanelTaiwan();
		}
		return null;
	}

}
