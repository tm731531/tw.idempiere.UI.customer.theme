# iDempiere 2Pack PackIn / PackOut & Plug-In Auto-Install Guide

This document explains how to create **PackOut**, perform **PackIn**, and configure **automatic PackIn** inside an iDempiere Plug-In project.  
Applies to **iDempiere 12** and OSGi plug-in development.

## 1. Overview
iDempiere’s **2Pack** system allows migration of configuration between environments.

## 2. Creating a PackOut
### 2.1 Choose Client
- System-level objects → login as *System Administrator*.
- Client-level data → login to specific client.

### 2.2 Open PackOut Window
`Application Dictionary → Application Packaging → PackOut`

### 2.3 Fill Header
- Name
- Version
- Date From
- Export Dictionary Entity

### 2.4 Package Details
Define exported objects such as windows, tables, SQL-based exports.

### 2.5 Export
Click **Export Package** to generate `.zip`.

## 3. PackIn (Manual)
1. Open `PackIn`
2. Upload `.zip`
3. Execute PackIn

## 4. Automatic PackIn Inside Plug-in
Place the 2Pack zip file in `META-INF/` and set:

```
Bundle-Activator: org.adempiere.plugin.utils.AdempiereActivator
```

iDempiere auto-imports when plug-in loads.

## 5. Best Practices
- Keep package version = bundle version
- Use modular 2Pack exports
- Test PackIn on clean tenant

## 6. Summary Workflow
DEV → PackOut → Plug-in META-INF → Deploy → Auto PackIn
