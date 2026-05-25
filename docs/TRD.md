# Jewellery Business Operating System (JBOS)
# Technical Requirements Document (TRD)
Version: 1.0
Module: V1 – Luxury Jewellery Quotation System

---

# 1. Technical Overview

JBOS V1 is a full-stack quotation generation platform.

The system converts:

User Input
→ Pricing Engine
→ Database Record
→ HTML Template Rendering
→ PDF Generation

into a luxury quotation document.

System follows modular architecture for future ERP expansion.

---

# 2. Locked Technology Stack

## Frontend

Framework:
- React

Bundler:
- Vite

Styling:
- Tailwind CSS

Purpose:
- Fast UI
- Component-based development
- Scalable architecture

---

## Backend

Runtime:
- Node.js

Framework:
- Express.js

Purpose:
- API handling
- Pricing engine
- Template rendering
- PDF pipeline

---

## Database

Engine:
- SQLite

Reason:

- Zero setup
- Lightweight
- Local file database
- Easy Claude Code integration
- Migration possible later

Future:

SQLite
→ PostgreSQL

---

## PDF Engine

Library:
- Puppeteer

Purpose:

Render HTML quotation
→ exact PDF output

Reason:

- Pixel-perfect rendering
- Matches approved quotation design
- Better than PDFKit for luxury layouts

---

## File Storage

Local filesystem.

Used for:

- Jewellery images
- CAD uploads
- Generated PDFs

Folder:

uploads/

---

# 3. System Architecture

High level:

React Frontend
↓
Express Backend
↓
SQLite Database
↓
HTML Template Engine
↓
Puppeteer PDF
↓
Generated Quotation

---

# 4. Project Structure

Recommended:

root/

client/
server/
templates/
database/
uploads/
docs/

---

Detailed:

root
├── client
│   ├── src
│   │   ├── pages
│   │   ├── components
│   │   ├── services
│   │   ├── hooks
│   │   ├── utils
│   │   └── App.jsx
│
├── server
│   ├── routes
│   ├── controllers
│   ├── services
│   ├── database
│   ├── utils
│   └── server.js
│
├── templates
│   ├── quotation.html
│   └── quotation.css
│
├── uploads
│
├── database
│   └── jbos.sqlite
│
└── docs

---

# 5. Frontend Architecture

Pages:

1 Dashboard
2 CreateQuotation
3 QuotationPreview
4 QuotationHistory

---

## Dashboard

Purpose:

Landing page.

Displays:

- Total quotations
- Recent quotations
- Quick actions

---

## Create Quotation

Primary form page.

Sections:

Customer Details

Jewellery Details

Pricing Summary

Buttons:

Preview

Generate

Save

---

## Preview Page

Purpose:

Preview rendered quotation before PDF.

Uses:

Rendered HTML template.

---

## History Page

Purpose:

List saved quotations.

Actions:

- Open
- Preview
- Download

---

# 6. Backend Architecture

Backend follows:

Route
→ Controller
→ Service

pattern.

---

## Routes

Purpose:

Receive API requests.

Examples:

/api/quotations
/api/rates
/api/pdf

---

## Controllers

Purpose:

Handle request logic.

Examples:

QuotationController

PDFController

RateController

---

## Services

Business logic.

Includes:

PricingService

TemplateService

PDFService

DatabaseService

---

# 7. Database Design

SQLite database:

jbos.sqlite

---

## Table: quotations

Purpose:

Store quotation records.

Fields:

id
quote_number
customer_name
mobile
email
occasion

product_category
metal_type
metal_color
purity

gross_weight
net_weight

diamond_type
diamond_shape
diamond_carat

gemstone

hallmark
certification
shipping

gold_cost
diamond_cost
gemstone_cost
making_charge

subtotal
gst
final_price

status

image_path

created_at

---

## Table: gold_rates

Fields:

id
purity
purity_factor
rate_per_gram

---

## Table: diamond_rates

Fields:

id
shape
color
clarity
rate_per_carat

---

## Table: gemstone_rates

Fields:

id
gemstone
grade
price

---

## Table: making_charges

Fields:

id
category
model
value

Models:

Per Gram

Fixed

Percentage

---

# 8. Quotation Template System

Official template:

Approved HTML quotation.

Do NOT redesign.

Template becomes:

quotation.html

inside:

templates/

---

## Placeholder Strategy

Replace hardcoded values.

Example:

Before:

Mr. Vikram Rathore

After:

{{customer_name}}

---

Examples:

{{quote_id}}

{{customer_name}}

{{product_name}}

{{gold_cost}}

{{final_price}}

{{generated_date}}

---

Template rendering uses:

String replacement.

TemplateService handles this.

---

# 9. Pricing Engine

Pricing engine handled in:

PricingService

---

Logic:

Gold Cost

= Net Weight × Gold Rate

---

Diamond Cost

= Carat × Rate

---

Making Charge

Three models:

Per Gram

Fixed

Percentage

---

Subtotal

= All Costs

---

GST

= Subtotal × 3%

---

Final Price

= Subtotal + GST

---

Pricing must be deterministic.

No manual totals.

---

# 10. API Design

REST architecture.

---

## Create Quotation

POST

/api/quotations

Purpose:

Save quotation.

---

## Get Quotations

GET

/api/quotations

Purpose:

History.

---

## Get Single Quote

GET

/api/quotations/:id

Purpose:

Preview.

---

## Generate PDF

POST

/api/pdf/:id

Purpose:

Render quotation PDF.

---

## Rates

GET

/api/rates

Purpose:

Fetch rate masters.

---

# 11. Template Rendering Flow

Core pipeline:

Quotation Record
↓
Load quotation.html
↓
Replace placeholders
↓
Rendered HTML
↓
Pass to Puppeteer
↓
Generate PDF

---

Template Service:

Responsible for:

- Load template
- Inject values
- Return HTML

---

# 12. PDF Pipeline

Handled by:

PDFService

Flow:

Load Rendered HTML
↓
Launch Puppeteer
↓
Render A4
↓
Generate PDF
↓
Save / Return File

Settings:

A4

Print Background:

true

Margins:

0

Reason:

Preserve luxury design.

---

# 13. Validation Rules

Frontend validation:

Required:

Customer Name

Product Category

Purity

Weight

---

Backend validation:

Prevent:

Negative weights

Invalid purity

Empty quotation

Invalid pricing

---

# 14. Error Handling

Standard API format:

success

message

data

error

---

Examples:

400

Validation Error

404

Quote Not Found

500

Internal Error

---

# 15. Environment Variables

Use:

.env

Examples:

PORT

DATABASE_PATH

UPLOAD_PATH

PDF_OUTPUT_PATH

---

No hardcoded configs.

---

# 16. Security Considerations

V1 security:

Basic only.

Includes:

Input validation

File validation

Sanitized rendering

No HTML injection

Authentication excluded from V1.

---

# 17. Deployment Strategy

V1 deployment:

Local first.

Run:

Frontend

Backend

SQLite

Same machine.

Later:

Docker

Cloud

Multi-user.

---

# 18. Future Migration

Architecture designed for:

V2

Live pricing APIs

PostgreSQL

Cloud storage

---

V3

CRM

ERP

Inventory

Manufacturing

---

# 19. Coding Standards

Claude Code must follow:

- Modular code
- Reusable components
- Service-based logic
- Clear naming
- No giant files
- No duplicated logic
- Clean imports

---

# 20. Development Phases

Phase 1

Project setup

---

Phase 2

Database

Pricing engine

---

Phase 3

Form UI

---

Phase 4

Template injection

Preview

---

Phase 5

PDF generation

---

Phase 6

History module

---

# 21. Completion Criteria

TRD complete when:

- Structure created
- DB working
- Pricing working
- Template renders
- PDF generates
- History works
- System stable

---

END OF TRD