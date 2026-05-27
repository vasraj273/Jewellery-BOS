\# JBOS Phase 2 PRD  

\## Foundation Layer + CRM Readiness



\---



\# Project



\*\*Jewellery Business Operating System (JBOS)\*\*



\*\*Phase:\*\*  

Phase 2 — Foundation + Access Control + Master Data



\---



\# Goal



Transform JBOS from quotation software into the foundation of a real Jewellery Business Operating System.



Do not redesign or break Phase-1 features.



Build scalable architecture for future:



\- CRM

\- HRMS

\- ERP



\---



\# Phase 2 Objectives



1\. Authentication system

2\. User management

3\. Role Based Access Control (RBAC)

4\. Company settings

5\. Master Data Management

6\. CRM-ready architecture

7\. Preserve existing quotation system



\---



\# Existing System (Must Preserve)



Already working:



\- Quotations

\- PDF generation

\- WhatsApp sending

\- Gold pricing

\- Render deployment

\- Neon PostgreSQL

\- Quotation history

\- Preview / Download



Do not redesign or break.



\---



\# Company Scope



Architecture:



\*\*Single Company\*\*



Not multi-tenant SaaS.



Single jewellery business deployment.



Future SaaS possible later.



\---



\# Authentication System



Authentication Type:



\*\*Email + Password\*\*



Purpose:



Internal JBOS users only.



Not customer login.



\---



\# Login Flow



User visits:



/login



Enters:



\- Email

\- Password



Then:



Authenticated session.



Preferred:



\- JWT auth

or

\- secure session implementation



Claude may choose cleanest architecture.



\---



\# No Public Signup



Critical:



No signup page.



No self-registration.



Users are created only by Admin.



\---



\# User Creation



Creation Method:



\*\*Admin-created users only\*\*



Flow:



Super Admin / Admin  

→ Create User  

→ Assign Role  

→ Set Temporary Password  

→ User logs in



No OTP.



No invite-email flow.



\---



\# Roles (RBAC)



\## 1. Super Admin



Full control.



Permissions:



\- All modules

\- All users

\- Settings

\- Master data

\- Reports

\- Quotations

\- Future CRM/HRMS



\---



\## 2. Admin / Manager



Operational control.



Permissions:



\- Quotations

\- Customers

\- Master data

\- Reports

\- Staff management



Cannot override Super Admin.



\---



\## 3. Sales Executive



Limited access.



Permissions:



\- Create quotations

\- Manage own customers

\- Own quotation history

\- Own activity



Restrictions:



No global access.



\---



\# Visibility Rules



Critical:



Sales executives see:



\*\*Own data only\*\*



Sales Executive A:



Can see:



\- Own quotations

\- Own customers



Cannot see:



\- Executive B data



Admin and Super Admin:



See all.



\---



\# User Table



Create:



users



Suggested fields:



\- id

\- full\_name

\- email

\- password\_hash

\- role

\- is\_active

\- created\_at

\- updated\_at



Passwords:



Must be hashed.



Preferred:



\- bcrypt

or

\- argon



Never plaintext.



\---



\# Company Settings Module



Create:



Settings



Purpose:



Remove hardcoded business identity.



Admin editable.



\---



\## Company Fields



Business:



\- Company name

\- Logo

\- GST

\- Address

\- Phone

\- Email

\- Website



Quotation:



\- Footer

\- Terms

\- Validity days

\- WhatsApp default message

\- Branding



Pricing:



\- Default location

\- Default markup

\- Pricing preferences



Requirement:



Quotation PDF and previews must use DB settings.



No hardcoded branding.



\---



\# Master Data Management



Create:



Master Data



Goal:



No hardcoded dropdowns.



Admin editable from UI.



\---



\## Editable Masters



\### Product Categories



Examples:



\- Ring

\- Pendant

\- Bracelet



\---



\### Metal Types



Examples:



\- Gold

\- Silver

\- Platinum



\---



\### Purity



Examples:



\- 18kt

\- 22kt



\---



\### Diamond Types



Examples:



\- VVS

\- VS

\- SI



\---



\### Cities



Examples:



\- Mumbai

\- Ahmedabad

\- Delhi



\---



\### Making Charge Presets



Admin configurable.



\---



\### Pricing Configuration



Admin configurable.



No code edits required.



\---



\# Navigation Updates



Add role-aware admin navigation.



Suggested:



\- Dashboard

\- Create Quotation

\- History

\- Settings



Sales Executive:



No Settings access.



\---



\# Security Requirements



Must include:



\- Protected routes

\- Auth middleware

\- Role middleware

\- Password hashing

\- Logout

\- Token/session validation



Unauthenticated users:



Redirect to:



/login



\---



\# Database



Use:



\*\*Neon PostgreSQL\*\*



Only.



No SQLite fallback.



\---



\# UI / Design



Preserve:



\- Luxury styling

\- Gold / black theme

\- Mobile responsiveness

\- Hamburger navigation



Do not redesign Phase-1 UI.



Only extend.



\---



\# Future Readiness



Phase-2 must prepare for:



\## CRM



\- Customers

\- Leads

\- Followups

\- Pipeline



\---



\## HRMS



\- Employees

\- Permissions

\- Ownership



\---



\## ERP



\- Inventory

\- Vendors

\- Finance



Architecture must remain scalable.



\---



\# Deliverables



Claude should implement:



1\. Login/Auth

2\. Users + Roles

3\. RBAC

4\. Company Settings

5\. Master Data

6\. Route protection

7\. DB schema updates

8\. Responsive UI integration



\---



\# Final Report



Reply short.



Include:



\- Auth flow

\- Roles

\- DB changes

\- Settings module

\- Master data

\- Routes added

\- Test steps



\---

