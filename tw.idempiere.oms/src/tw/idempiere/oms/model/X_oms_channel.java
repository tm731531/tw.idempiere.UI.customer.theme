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

/** Generated Model for oms_channel
 *  @author iDempiere (generated)
 *  @version Release 12 - $Id$ */
@org.adempiere.base.Model(table="oms_channel")
public class X_oms_channel extends PO implements I_oms_channel, I_Persistent
{

	/**
	 *
	 */
	private static final long serialVersionUID = 20251202L;

    /** Standard Constructor */
    public X_oms_channel (Properties ctx, int oms_channel_ID, String trxName)
    {
      super (ctx, oms_channel_ID, trxName);
      /** if (oms_channel_ID == 0)
        {
			setName (null);
			setoms_channel_ID (0);
        } */
    }

    /** Standard Constructor */
    public X_oms_channel (Properties ctx, int oms_channel_ID, String trxName, String ... virtualColumns)
    {
      super (ctx, oms_channel_ID, trxName, virtualColumns);
      /** if (oms_channel_ID == 0)
        {
			setName (null);
			setoms_channel_ID (0);
        } */
    }

    /** Standard Constructor */
    public X_oms_channel (Properties ctx, String oms_channel_UU, String trxName)
    {
      super (ctx, oms_channel_UU, trxName);
      /** if (oms_channel_UU == null)
        {
			setName (null);
			setoms_channel_ID (0);
        } */
    }

    /** Standard Constructor */
    public X_oms_channel (Properties ctx, String oms_channel_UU, String trxName, String ... virtualColumns)
    {
      super (ctx, oms_channel_UU, trxName, virtualColumns);
      /** if (oms_channel_UU == null)
        {
			setName (null);
			setoms_channel_ID (0);
        } */
    }

    /** Load Constructor */
    public X_oms_channel (Properties ctx, ResultSet rs, String trxName)
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
      StringBuilder sb = new StringBuilder ("X_oms_channel[")
        .append(get_ID()).append(",Name=").append(getName()).append("]");
      return sb.toString();
    }

	/** Set ISO Country Code.
		@param CountryCode Upper-case two-letter alphanumeric ISO Country code according to ISO 3166-1
	*/
	public void setCountryCode (String CountryCode)
	{
		set_Value (COLUMNNAME_CountryCode, CountryCode);
	}

	/** Get ISO Country Code.
		@return Upper-case two-letter alphanumeric ISO Country code according to ISO 3166-1
	  */
	public String getCountryCode()
	{
		return (String)get_Value(COLUMNNAME_CountryCode);
	}

	/** Set Currency.
		@param Currency Currency
	*/
	public void setCurrency (String Currency)
	{
		set_ValueNoCheck (COLUMNNAME_Currency, Currency);
	}

	/** Get Currency.
		@return Currency	  */
	public String getCurrency()
	{
		return (String)get_Value(COLUMNNAME_Currency);
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

	/** Set Merchant_ID.
		@param Merchant_ID Merchant_ID
	*/
	public void setMerchant_ID (String Merchant_ID)
	{
		set_Value (COLUMNNAME_Merchant_ID, Merchant_ID);
	}

	/** Get Merchant_ID.
		@return Merchant_ID	  */
	public String getMerchant_ID()
	{
		return (String)get_Value(COLUMNNAME_Merchant_ID);
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

	/** Set Remark.
		@param Remark Remark
	*/
	public void setRemark (String Remark)
	{
		set_Value (COLUMNNAME_Remark, Remark);
	}

	/** Get Remark.
		@return Remark	  */
	public String getRemark()
	{
		return (String)get_Value(COLUMNNAME_Remark);
	}

	/** Set Store_Code.
		@param Store_Code Store_Code
	*/
	public void setStore_Code (String Store_Code)
	{
		set_Value (COLUMNNAME_Store_Code, Store_Code);
	}

	/** Get Store_Code.
		@return Store_Code	  */
	public String getStore_Code()
	{
		return (String)get_Value(COLUMNNAME_Store_Code);
	}

	/** Set Time Zone.
		@param TimeZone Time zone name
	*/
	public void setTimeZone (String TimeZone)
	{
		set_Value (COLUMNNAME_TimeZone, TimeZone);
	}

	/** Get Time Zone.
		@return Time zone name
	  */
	public String getTimeZone()
	{
		return (String)get_Value(COLUMNNAME_TimeZone);
	}

	/** Set Token1.
		@param Token1 Token1
	*/
	public void setToken1 (String Token1)
	{
		set_Value (COLUMNNAME_Token1, Token1);
	}

	/** Get Token1.
		@return Token1	  */
	public String getToken1()
	{
		return (String)get_Value(COLUMNNAME_Token1);
	}

	/** Set Token2.
		@param Token2 Token2
	*/
	public void setToken2 (String Token2)
	{
		set_Value (COLUMNNAME_Token2, Token2);
	}

	/** Get Token2.
		@return Token2	  */
	public String getToken2()
	{
		return (String)get_Value(COLUMNNAME_Token2);
	}

	/** Set Token3.
		@param Token3 Token3
	*/
	public void setToken3 (String Token3)
	{
		set_Value (COLUMNNAME_Token3, Token3);
	}

	/** Get Token3.
		@return Token3	  */
	public String getToken3()
	{
		return (String)get_Value(COLUMNNAME_Token3);
	}

	/** Set Token4.
		@param Token4 Token4
	*/
	public void setToken4 (String Token4)
	{
		set_Value (COLUMNNAME_Token4, Token4);
	}

	/** Get Token4.
		@return Token4	  */
	public String getToken4()
	{
		return (String)get_Value(COLUMNNAME_Token4);
	}

	/** Set Token5.
		@param Token5 Token5
	*/
	public void setToken5 (String Token5)
	{
		set_Value (COLUMNNAME_Token5, Token5);
	}

	/** Get Token5.
		@return Token5	  */
	public String getToken5()
	{
		return (String)get_Value(COLUMNNAME_Token5);
	}

	/** Set Token_Expire.
		@param Token_Expire Token_Expire
	*/
	public void setToken_Expire (int Token_Expire)
	{
		set_Value (COLUMNNAME_Token_Expire, Integer.valueOf(Token_Expire));
	}

	/** Get Token_Expire.
		@return Token_Expire	  */
	public int getToken_Expire()
	{
		Integer ii = (Integer)get_Value(COLUMNNAME_Token_Expire);
		if (ii == null)
			 return 0;
		return ii.intValue();
	}

	/** Set Warehouse_Code.
		@param Warehouse_Code Warehouse_Code
	*/
	public void setWarehouse_Code (String Warehouse_Code)
	{
		set_Value (COLUMNNAME_Warehouse_Code, Warehouse_Code);
	}

	/** Get Warehouse_Code.
		@return Warehouse_Code	  */
	public String getWarehouse_Code()
	{
		return (String)get_Value(COLUMNNAME_Warehouse_Code);
	}

	/** Set oms_channel.
		@param oms_channel_ID oms_channel
	*/
	public void setoms_channel_ID (int oms_channel_ID)
	{
		if (oms_channel_ID < 1)
			set_ValueNoCheck (COLUMNNAME_oms_channel_ID, null);
		else
			set_ValueNoCheck (COLUMNNAME_oms_channel_ID, Integer.valueOf(oms_channel_ID));
	}

	/** Get oms_channel.
		@return oms_channel	  */
	public int getoms_channel_ID()
	{
		Integer ii = (Integer)get_Value(COLUMNNAME_oms_channel_ID);
		if (ii == null)
			 return 0;
		return ii.intValue();
	}

	/** Set oms_channel_UU.
		@param oms_channel_UU oms_channel_UU
	*/
	public void setoms_channel_UU (String oms_channel_UU)
	{
		set_Value (COLUMNNAME_oms_channel_UU, oms_channel_UU);
	}

	/** Get oms_channel_UU.
		@return oms_channel_UU	  */
	public String getoms_channel_UU()
	{
		return (String)get_Value(COLUMNNAME_oms_channel_UU);
	}

	public I_oms_platform getoms_platform() throws RuntimeException
	{
		return (I_oms_platform)MTable.get(getCtx(), I_oms_platform.Table_ID)
			.getPO(getoms_platform_ID(), get_TrxName());
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
}