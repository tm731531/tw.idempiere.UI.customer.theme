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
package tw.idempiere.oms.model;

import java.math.BigDecimal;
import java.sql.Timestamp;
import org.compiere.model.*;
import org.compiere.util.KeyNamePair;

/** Generated Interface for oms_channel
 *  @author iDempiere (generated) 
 *  @version Release 12
 */
@SuppressWarnings("all")
public interface I_oms_channel 
{

    /** TableName=oms_channel */
    public static final String Table_Name = "oms_channel";

    /** AD_Table_ID=1000013 */
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

    /** Column name CountryCode */
    public static final String COLUMNNAME_CountryCode = "CountryCode";

	/** Set ISO Country Code.
	  * Upper-case two-letter alphanumeric ISO Country code according to ISO 3166-1
	  */
	public void setCountryCode (String CountryCode);

	/** Get ISO Country Code.
	  * Upper-case two-letter alphanumeric ISO Country code according to ISO 3166-1
	  */
	public String getCountryCode();

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

    /** Column name Currency */
    public static final String COLUMNNAME_Currency = "Currency";

	/** Set Currency	  */
	public void setCurrency (String Currency);

	/** Get Currency	  */
	public String getCurrency();

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

    /** Column name Merchant_ID */
    public static final String COLUMNNAME_Merchant_ID = "Merchant_ID";

	/** Set Merchant_ID	  */
	public void setMerchant_ID (String Merchant_ID);

	/** Get Merchant_ID	  */
	public String getMerchant_ID();

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

    /** Column name Remark */
    public static final String COLUMNNAME_Remark = "Remark";

	/** Set Remark	  */
	public void setRemark (String Remark);

	/** Get Remark	  */
	public String getRemark();

    /** Column name Store_Code */
    public static final String COLUMNNAME_Store_Code = "Store_Code";

	/** Set Store_Code	  */
	public void setStore_Code (String Store_Code);

	/** Get Store_Code	  */
	public String getStore_Code();

    /** Column name TimeZone */
    public static final String COLUMNNAME_TimeZone = "TimeZone";

	/** Set Time Zone.
	  * Time zone name
	  */
	public void setTimeZone (String TimeZone);

	/** Get Time Zone.
	  * Time zone name
	  */
	public String getTimeZone();

    /** Column name Token1 */
    public static final String COLUMNNAME_Token1 = "Token1";

	/** Set Token1	  */
	public void setToken1 (String Token1);

	/** Get Token1	  */
	public String getToken1();

    /** Column name Token2 */
    public static final String COLUMNNAME_Token2 = "Token2";

	/** Set Token2	  */
	public void setToken2 (String Token2);

	/** Get Token2	  */
	public String getToken2();

    /** Column name Token3 */
    public static final String COLUMNNAME_Token3 = "Token3";

	/** Set Token3	  */
	public void setToken3 (String Token3);

	/** Get Token3	  */
	public String getToken3();

    /** Column name Token4 */
    public static final String COLUMNNAME_Token4 = "Token4";

	/** Set Token4	  */
	public void setToken4 (String Token4);

	/** Get Token4	  */
	public String getToken4();

    /** Column name Token5 */
    public static final String COLUMNNAME_Token5 = "Token5";

	/** Set Token5	  */
	public void setToken5 (String Token5);

	/** Get Token5	  */
	public String getToken5();

    /** Column name Token_Expire */
    public static final String COLUMNNAME_Token_Expire = "Token_Expire";

	/** Set Token_Expire	  */
	public void setToken_Expire (int Token_Expire);

	/** Get Token_Expire	  */
	public int getToken_Expire();

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

    /** Column name Warehouse_Code */
    public static final String COLUMNNAME_Warehouse_Code = "Warehouse_Code";

	/** Set Warehouse_Code	  */
	public void setWarehouse_Code (String Warehouse_Code);

	/** Get Warehouse_Code	  */
	public String getWarehouse_Code();

    /** Column name oms_channel_ID */
    public static final String COLUMNNAME_oms_channel_ID = "oms_channel_ID";

	/** Set oms_channel	  */
	public void setoms_channel_ID (int oms_channel_ID);

	/** Get oms_channel	  */
	public int getoms_channel_ID();

    /** Column name oms_channel_UU */
    public static final String COLUMNNAME_oms_channel_UU = "oms_channel_UU";

	/** Set oms_channel_UU	  */
	public void setoms_channel_UU (String oms_channel_UU);

	/** Get oms_channel_UU	  */
	public String getoms_channel_UU();

    /** Column name oms_platform_ID */
    public static final String COLUMNNAME_oms_platform_ID = "oms_platform_ID";

	/** Set oms_platform	  */
	public void setoms_platform_ID (int oms_platform_ID);

	/** Get oms_platform	  */
	public int getoms_platform_ID();

	public I_oms_platform getoms_platform() throws RuntimeException;
}
