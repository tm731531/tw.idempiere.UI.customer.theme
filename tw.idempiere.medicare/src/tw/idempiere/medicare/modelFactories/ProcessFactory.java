package tw.idempiere.medicare.modelFactories;

import org.adempiere.base.IProcessFactory;
import org.compiere.process.ProcessCall;

import tw.idempiere.medicare.process.*;


public class ProcessFactory  implements IProcessFactory {

	@Override
	public ProcessCall newProcessInstance(String className) {
		// TODO Auto-generated method stub
		if(className.equals(GenerateSuggestion.class.getName())) {
			return new GenerateSuggestion();
		}
		if(className.equals(RagicFetchToPO.class.getName())) {
			return new RagicFetchToPO();
		}
		
		return null;
	}

}