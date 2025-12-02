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
/** Generated Model - DO NOT CHANGE */
package tw.idempiere.oms.model;

import java.sql.ResultSet;
import java.util.Properties;
import org.compiere.model.*;

/** Generated Model for oms_platform
 *  @author iDempiere (generated)
 *  @version Release 12 - $Id$ */
@org.adempiere.base.Model(table="oms_platform")
public class X_oms_platform extends PO implements I_oms_platform, I_Persistent
{

	/**
	 *
	 */
	private static final long serialVersionUID = 20251202L;

    /** Standard Constructor */
    public X_oms_platform (Properties ctx, int oms_platform_ID, String trxName)
    {
      super (ctx, oms_platform_ID, trxName);
      /** if (oms_platform_ID == 0)
        {
			setName (null);
			setoms_platform_ID (0);
        } */
    }

    /** Standard Constructor */
    public X_oms_platform (Properties ctx, int oms_platform_ID, String trxName, String ... virtualColumns)
    {
      super (ctx, oms_platform_ID, trxName, virtualColumns);
      /** if (oms_platform_ID == 0)
        {
			setName (null);
			setoms_platform_ID (0);
        } */
    }

    /** Standard Constructor */
    public X_oms_platform (Properties ctx, String oms_platform_UU, String trxName)
    {
      super (ctx, oms_platform_UU, trxName);
      /** if (oms_platform_UU == null)
        {
			setName (null);
			setoms_platform_ID (0);
        } */
    }

    /** Standard Constructor */
    public X_oms_platform (Properties ctx, String oms_platform_UU, String trxName, String ... virtualColumns)
    {
      super (ctx, oms_platform_UU, trxName, virtualColumns);
      /** if (oms_platform_UU == null)
        {
			setName (null);
			setoms_platform_ID (0);
        } */
    }

    /** Load Constructor */
    public X_oms_platform (Properties ctx, ResultSet rs, String trxName)
    {
      super (ctx, rs, trxName);
    }

    /** AccessLevel
      * @return 3 - Client - Org
      */
    protected int get_AccessLevel()
    {
      return accessLevel.intValue();
    }

    /** Load Meta Data */
    protected POInfo initPO (Properties ctx)
    {
      POInfo poi = POInfo.getPOInfo (ctx, Table_ID, get_TrxName());
      return poi;
    }

    public String toString()
    {
      StringBuilder sb = new StringBuilder ("X_oms_platform[")
        .append(get_ID()).append(",Name=").append(getName()).append("]");
      return sb.toString();
    }

	/** Set API_Base_URL.
		@param API_Base_URL API_Base_URL
	*/
	public void setAPI_Base_URL (String API_Base_URL)
	{
		set_Value (COLUMNNAME_API_Base_URL, API_Base_URL);
	}

	/** Get API_Base_URL.
		@return API_Base_URL	  */
	public String getAPI_Base_URL()
	{
		return (String)get_Value(COLUMNNAME_API_Base_URL);
	}

	/** TOKEN = 1 */
	public static final String AUTH_TYPE_TOKEN = "1";
	/** OAUTH = 2 */
	public static final String AUTH_TYPE_OAUTH = "2";
	/** SIGNATURE = 3 */
	public static final String AUTH_TYPE_SIGNATURE = "3";
	/** Set Auth_Type.
		@param Auth_Type Auth_Type
	*/
	public void setAuth_Type (String Auth_Type)
	{

		set_Value (COLUMNNAME_Auth_Type, Auth_Type);
	}

	/** Get Auth_Type.
		@return Auth_Type	  */
	public String getAuth_Type()
	{
		return (String)get_Value(COLUMNNAME_Auth_Type);
	}

	/** Set Description.
		@param Description Optional short description of the record
	*/
	public void setDescription (String Description)
	{
		set_Value (COLUMNNAME_Description, Description);
	}

	/** Get Description.
		@return Optional short description of the record
	  */
	public String getDescription()
	{
		return (String)get_Value(COLUMNNAME_Description);
	}

	/** Set Name.
		@param Name Alphanumeric identifier of the entity
	*/
	public void setName (String Name)
	{
		set_Value (COLUMNNAME_Name, Name);
	}

	/** Get Name.
		@return Alphanumeric identifier of the entity
	  */
	public String getName()
	{
		return (String)get_Value(COLUMNNAME_Name);
	}

	/** Set Thirdparty_Client_ID.
		@param Thirdparty_Client_ID Thirdparty_Client_ID
	*/
	public void setThirdparty_Client_ID (String Thirdparty_Client_ID)
	{
		set_Value (COLUMNNAME_Thirdparty_Client_ID, Thirdparty_Client_ID);
	}

	/** Get Thirdparty_Client_ID.
		@return Thirdparty_Client_ID	  */
	public String getThirdparty_Client_ID()
	{
		return (String)get_Value(COLUMNNAME_Thirdparty_Client_ID);
	}

	/** Set Thirdparty_Client_Secret.
		@param Thirdparty_Client_Secret Thirdparty_Client_Secret
	*/
	public void setThirdparty_Client_Secret (String Thirdparty_Client_Secret)
	{
		set_Value (COLUMNNAME_Thirdparty_Client_Secret, Thirdparty_Client_Secret);
	}

	/** Get Thirdparty_Client_Secret.
		@return Thirdparty_Client_Secret	  */
	public String getThirdparty_Client_Secret()
	{
		return (String)get_Value(COLUMNNAME_Thirdparty_Client_Secret);
	}

	/** Set oms_platform.
		@param oms_platform_ID oms_platform
	*/
	public void setoms_platform_ID (int oms_platform_ID)
	{
		if (oms_platform_ID < 1)
			set_ValueNoCheck (COLUMNNAME_oms_platform_ID, null);
		else
			set_ValueNoCheck (COLUMNNAME_oms_platform_ID, Integer.valueOf(oms_platform_ID));
	}

	/** Get oms_platform.
		@return oms_platform	  */
	public int getoms_platform_ID()
	{
		Integer ii = (Integer)get_Value(COLUMNNAME_oms_platform_ID);
		if (ii == null)
			 return 0;
		return ii.intValue();
	}

	/** Set oms_platform_UU.
		@param oms_platform_UU oms_platform_UU
	*/
	public void setoms_platform_UU (String oms_platform_UU)
	{
		set_Value (COLUMNNAME_oms_platform_UU, oms_platform_UU);
	}

	/** Get oms_platform_UU.
		@return oms_platform_UU	  */
	public String getoms_platform_UU()
	{
		return (String)get_Value(COLUMNNAME_oms_platform_UU);
	}
}