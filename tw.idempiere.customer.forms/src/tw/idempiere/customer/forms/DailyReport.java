package tw.idempiere.customer.forms;

import org.adempiere.webui.panel.ADForm;
import org.adempiere.webui.panel.IFormController;
import org.idempiere.ui.zk.annotation.Form;
import org.zkoss.zk.ui.Executions;

/**
 * The Form class that iDempiere instantiates.
 * Renamed to DailyReport to match the iDempiere AD_Form Classname setting.
 */
@Form
public class DailyReport extends ADForm implements IFormController {

    private static final long serialVersionUID = 1L;

    @Override
    public ADForm getForm() {
        return this;
    }

    @Override
    protected void initForm() {
        ClassLoader cl = Thread.currentThread().getContextClassLoader();
        try {
            // Standardized path for iDempiere ZK resources
            Thread.currentThread().setContextClassLoader(getClass().getClassLoader());
            Executions.createComponents("~./DailyReport.zul", this, null);
        } finally {
            Thread.currentThread().setContextClassLoader(cl);
        }
    }
}
