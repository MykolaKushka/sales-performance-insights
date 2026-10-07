# Sales Performance Insights — PRD

## Product goal

A private browser-based dashboard that turns an uploaded SaaS sales CSV into monthly insights by region, sales representative, and product.

## First release

- Upload and validate CSV data.
- Process all rows locally in the browser.
- Show total revenue, won deals, win rate, and average deal size.
- Switch between Revenue, Deals Closed, and Average Deal Size.
- Compare regions, sales representatives, and products.
- Highlight top performers and results below 75% of their group average.
- Generate a plain-language executive summary from calculated results.
- Print or save the report as PDF.

## Required CSV columns

`Deal_ID`, `Close_Date`, `Region`, `Sales_Rep`, `Product`, `Deal_Status`, `Revenue`.

`Deal_Status` accepts `Closed Won` or `Closed Lost`. Revenue must be zero for a lost deal.

## Metric rules

- Revenue: sum of revenue for won deals.
- Deals Closed: count of won deals.
- Average Deal Size: won-deal revenue divided by won deals.
- Top performer: highest selected metric, including ties.
- Needs attention: below 75% of the group average for the selected metric.

## Privacy

CSV parsing, aggregation, and summary generation happen locally. The first release does not send uploaded data to an AI API.
