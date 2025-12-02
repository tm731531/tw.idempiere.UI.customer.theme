/******************************************************************************
 * Product: iDempiere ERP & CRM Smart Business Solution                       *
 * Copyright (C) 1999-2012 ComPiere, Inc. All Rights Reserved.                *
 * This program is free software, you can redistribute it and/or modify it    *
 * under the terms version 2 of the GNU General Public License as published   *
 * by the Free Software Foundation. This program is distributed in the hope   *
 * that it will be useful, but WITHOUT ANY WARRANTY, without even the implied *
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.           *
 * See the GNU General Public License for more details.                       *
 * You should have received a copy of the GNU General Public License along    *
 * with this program, if not, write to the Free Software Foundation, Inc.,    *
 * 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA.                     *
 * For the text or an alternative of this public license, you may reach us    *
 * ComPiere, Inc., 2620 Augustine Dr. #245, Santa Clara, CA 95054, USA        *
 * or via info@compiere.org or http://www.compiere.org/license.html           *
 *****************************************************************************/
package tw.idempiere.oms;

import java.math.BigDecimal;
import java.sql.Timestamp;
import org.compiere.model.*;
import org.compiere.util.KeyNamePair;

/** Generated Interface for oms_platform
 *  @author iDempiere (generated) 
 *  @version Release 12
 */
@SuppressWarnings("all")
public interface I_oms_platform 
{

    /** TableName=oms_platform */
    public static final String Table_Name = "oms_platform";

    /** AD_Table_ID=1000012 */
    public static final int Table_ID = MTable.getTable_ID(Table_Name);

    KeyNamePair Model = new KeyNamePair(Table_ID, Table_Name);

    /** AccessLevel = 3 - Client - Org 
     */
    BigDecimal accessLevel = BigDecimal.valueOf(3);

    /** Load Meta Data */

    /** Column name AD_Client_ID */
    public static final String COLUMNNAME_AD_Client_ID = "AD_Client_ID";

	/** Get Tenant.
	  * Tenant for this installation.
	  */
	public int getAD_Client_ID();

    /** Column name AD_Org_ID */
    public static final String COLUMNNAME_AD_Org_ID = "AD_Org_ID";

	/** Set Organization.
	  * Organizational entity within tenant
	  */
	public void setAD_Org_ID (int AD_Org_ID);

	/** Get Organization.
	  * Organizational entity within tenant
	  */
	public int getAD_Org_ID();

    /** Column name API_Base_URL */
    public static final String COLUMNNAME_API_Base_URL = "API_Base_URL";

	/** Set API_Base_URL	  */
	public void setAPI_Base_URL (String API_Base_URL);

	/** Get API_Base_URL	  */
	public String getAPI_Base_URL();

    /** Column name Auth_Type */
    public static final String COLUMNNAME_Auth_Type = "Auth_Type";

	/** Set Auth_Type	  */
	public void setAuth_Type (String Auth_Type);

	/** Get Auth_Type	  */
	public String getAuth_Type();

    /** Column name Created */
    public static final String COLUMNNAME_Created = "Created";

	/** Get Created.
	  * Date this record was created
	  */
	public Timestamp getCreated();

    /** Column name CreatedBy */
    public static final String COLUMNNAME_CreatedBy = "CreatedBy";

	/** Get Created By.
	  * User who created this records
	  */
	public int getCreatedBy();

    /** Column name Description */
    public static final String COLUMNNAME_Description = "Description";

	/** Set Description.
	  * Optional short description of the record
	  */
	public void setDescription (String Description);

	/** Get Description.
	  * Optional short description of the record
	  */
	public String getDescription();

    /** Column name IsActive */
    public static final String COLUMNNAME_IsActive = "IsActive";

	/** Set Active.
	  * The record is active in the system
	  */
	public void setIsActive (boolean IsActive);

	/** Get Active.
	  * The record is active in the system
	  */
	public boolean isActive();

    /** Column name Name */
    public static final String COLUMNNAME_Name = "Name";

	/** Set Name.
	  * Alphanumeric identifier of the entity
	  */
	public void setName (String Name);

	/** Get Name.
	  * Alphanumeric identifier of the entity
	  */
	public String getName();

    /** Column name Thirdparty_Client_ID */
    public static final String COLUMNNAME_Thirdparty_Client_ID = "Thirdparty_Client_ID";

	/** Set Thirdparty_Client_ID	  */
	public void setThirdparty_Client_ID (String Thirdparty_Client_ID);

	/** Get Thirdparty_Client_ID	  */
	public String getThirdparty_Client_ID();

    /** Column name Thirdparty_Client_Secret */
    public static final String COLUMNNAME_Thirdparty_Client_Secret = "Thirdparty_Client_Secret";

	/** Set Thirdparty_Client_Secret	  */
	public void setThirdparty_Client_Secret (String Thirdparty_Client_Secret);

	/** Get Thirdparty_Client_Secret	  */
	public String getThirdparty_Client_Secret();

    /** Column name Updated */
    public static final String COLUMNNAME_Updated = "Updated";

	/** Get Updated.
	  * Date this record was updated
	  */
	public Timestamp getUpdated();

    /** Column name UpdatedBy */
    public static final String COLUMNNAME_UpdatedBy = "UpdatedBy";

	/** Get Updated By.
	  * User who updated this records
	  */
	public int getUpdatedBy();

    /** Column name oms_platform_ID */
    public static final String COLUMNNAME_oms_platform_ID = "oms_platform_ID";

	/** Set oms_platform	  */
	public void setoms_platform_ID (int oms_platform_ID);

	/** Get oms_platform	  */
	public int getoms_platform_ID();

    /** Column name oms_platform_UU */
    public static final String COLUMNNAME_oms_platform_UU = "oms_platform_UU";

	/** Set oms_platform_UU	  */
	public void setoms_platform_UU (String oms_platform_UU);

	/** Get oms_platform_UU	  */
	public String getoms_platform_UU();
}
