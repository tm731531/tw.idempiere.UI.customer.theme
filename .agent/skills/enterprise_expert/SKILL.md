# Enterprise System Expert Skill

This skill equips the agent with specialized knowledge for developing and maintaining enterprise-grade systems, specifically focusing on the iDempiere ecosystem and related technologies.

## Core Expertise
- **Business Domains**: ERP (Enterprise Resource Planning), CRM (Customer Relationship Management), OMS (Order Management System), and Financial Systems (財務系統).
- **Core Technology Stack**:
    - **iDempiere**: Understanding of its OSGi-based architecture, Model-View-Controller pattern, and metadata-driven approach.
    - **OSGi**: Module management, service Registry, and dynamic component lifecycle.
    - **ZK Framework**: Java-based UI framework, handling `.zul` files, and Composer/ViewModel patterns.
    - **PostgreSQL**: Advanced SQL querying, schema design, and performance tuning for large datasets.

## Development & Troubleshooting Best Practices

### 1. ZK Resource Loading in OSGi (iDempiere 12)
- **Problem**: ZUL files or JS resources not found in the bundle.
- **Solution**:
    - Add `ZK-Resource: /` to `META-INF/MANIFEST.MF`.
    - Put ZUL files in `src/web/` or a similar directory that is exported/built into the JAR.
    - Access ZUL via `~./` prefix (e.g., `~./zul/MyPage.zul`).
    - **Critical**: Use "ClassLoader Context Switching" when creating components:
      ```java
      ClassLoader original = Thread.currentThread().getContextClassLoader();
      try {
          Thread.currentThread().setContextClassLoader(getClass().getClassLoader());
          Executions.createComponents("~./zul/MyPage.zul", parent, null);
      } finally {
          Thread.currentThread().setContextClassLoader(original);
      }
      ```

### 2. Form Registration
- **Modern Approach**: Use the `@Form` annotation on the Form class (must implement `IFormController`).
- **Activation**: In `MyActivator.java`, use `Extensions.getMappedFormFactory().scan(bundleContext);` to auto-register forms.
- **AD Mapping**: Ensure the `Classname` in the iDempiere `AD_Form` window exactly matches the full package + class name (e.g., `tw.idempiere.customer.forms.DailyReport`).

### 3. ZK + Chart.js Integration
- **Why**: Avoid complex `JFreeChartEngine` OSGi dependency issues.
- **Implementation**:
    - Use HTML `<canvas>` inside ZUL.
    - Load Chart.js from a reliable CDN (prefer UMD version for better compatibility).
    - **Reliability**: Use ZK Widget ID lookup (`zk.Widget.$('$myDiv')`) in JS instead of raw UUIDs for better resilience in iDempiere's multi-window/AJAX environment.
    - **Sync**: Wrap JS execution in `zk.afterMount()` to ensure the DOM is ready.

### 4. Database Security & Multi-tenancy
- Always filter queries by `AD_Client_ID` using `Env.getAD_Client_ID(Env.getCtx())` to ensure data isolation.

## Contextual Awareness
When working on these systems, the agent should proactively check for OSGi compatibility and iDempiere's internal framework constraints. Always use `CLogger` for logging to align with iDempiere's logging system.
