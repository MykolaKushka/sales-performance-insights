# Sales Performance Insights

An interactive, privacy-conscious sales dashboard for monthly SaaS reviews.

## Features

- CSV upload with validation and useful row-level error messages
- KPI summary for revenue, wins, win rate, and average deal size
- Metric switching between Revenue, Deals Closed, and Average Deal Size
- Comparisons by region, sales representative, and product
- Top-performer and needs-attention labels, including tie handling
- Local plain-language executive summary
- Print / Save as PDF support
- Responsive layout and included sample dataset

## CSV format

Required columns:

```text
Deal_ID,Close_Date,Region,Sales_Rep,Product,Deal_Status,Revenue
```

Dates use `YYYY-MM-DD`. Deal status must be `Closed Won` or `Closed Lost`. Lost deals must have revenue `0`.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Open the local URL shown by the development server.

## Privacy

Uploaded files are parsed and analyzed in the browser. No raw sales data is sent to an external AI service in this release.

## Project files

- `PRD.md` — product requirements
- `public/sample-sales-data.csv` — test dataset
- `app/page.tsx` — dashboard UI and interactions
- `lib/sales.ts` — parsing, validation, and sales calculations

Generated folders such as `node_modules`, `dist`, `.next`, `.vinext`, and local environment files are intentionally excluded from the repository.
