package tw.idempiere.zul.form;

import org.adempiere.plugin.utils.Incremental2PackActivator;
import org.adempiere.webui.Extensions;
import org.osgi.framework.BundleContext;
import org.osgi.service.component.annotations.Component;


@Component(immediate = true)
public class MyActivator extends Incremental2PackActivator {
	
	public MyActivator() {
	}

	@Override
	public void start(BundleContext context) throws Exception {
		super.start(context);
		Extensions.getMappedFormFactory().scan(context, "tw.idempiere.zul.form");
	}

}
