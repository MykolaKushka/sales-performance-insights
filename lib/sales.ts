export type DealStatus = "Closed Won" | "Closed Lost";
export type Metric = "revenue" | "deals" | "average";
export type GroupKey = "region" | "rep" | "product";

export type Deal = {
  id: string;
  closeDate: string;
  region: string;
  rep: string;
  product: string;
  status: DealStatus;
  revenue: number;
};

export type Aggregate = {
  name: string;
  revenue: number;
  won: number;
  total: number;
  average: number;
};

export const metricLabels: Record<Metric, string> = {
  revenue: "Revenue",
  deals: "Deals closed",
  average: "Average deal size",
};

export const sampleCsv = `Deal_ID,Close_Date,Region,Sales_Rep,Product,Deal_Status,Revenue
D-1001,2026-09-02,North America,Ava Chen,Analytics Pro,Closed Won,18000
D-1002,2026-09-03,Europe,Liam Novak,Team Hub,Closed Won,12500
D-1003,2026-09-03,APAC,Maya Singh,Automation Suite,Closed Lost,0
D-1004,2026-09-04,Latin America,Diego Costa,Team Hub,Closed Won,9000
D-1005,2026-09-05,North America,Noah Williams,Automation Suite,Closed Won,24000
D-1006,2026-09-06,Europe,Sofia Rossi,Analytics Pro,Closed Lost,0
D-1007,2026-09-07,APAC,Maya Singh,Team Hub,Closed Won,11000
D-1008,2026-09-08,Latin America,Diego Costa,Analytics Pro,Closed Lost,0
D-1009,2026-09-09,North America,Ava Chen,Automation Suite,Closed Won,27000
D-1010,2026-09-09,Europe,Liam Novak,Analytics Pro,Closed Won,16000
D-1011,2026-09-10,APAC,Ethan Tan,Automation Suite,Closed Won,21000
D-1012,2026-09-11,Latin America,Camila Perez,Team Hub,Closed Lost,0
D-1013,2026-09-12,North America,Noah Williams,Analytics Pro,Closed Won,19500
D-1014,2026-09-13,Europe,Sofia Rossi,Team Hub,Closed Won,10000
D-1015,2026-09-14,APAC,Ethan Tan,Analytics Pro,Closed Won,14500
D-1016,2026-09-15,Latin America,Camila Perez,Automation Suite,Closed Won,15500
D-1017,2026-09-16,North America,Ava Chen,Team Hub,Closed Lost,0
D-1018,2026-09-17,Europe,Liam Novak,Automation Suite,Closed Won,22500
D-1019,2026-09-18,APAC,Maya Singh,Analytics Pro,Closed Lost,0
D-1020,2026-09-19,Latin America,Diego Costa,Automation Suite,Closed Lost,0
D-1021,2026-09-20,North America,Noah Williams,Team Hub,Closed Won,13000
D-1022,2026-09-21,Europe,Sofia Rossi,Analytics Pro,Closed Won,17500
D-1023,2026-09-22,APAC,Ethan Tan,Team Hub,Closed Lost,0
D-1024,2026-09-23,Latin America,Camila Perez,Analytics Pro,Closed Won,12000
D-1025,2026-09-24,North America,Ava Chen,Analytics Pro,Closed Won,20500
D-1026,2026-09-25,Europe,Liam Novak,Team Hub,Closed Lost,0
D-1027,2026-09-26,APAC,Maya Singh,Automation Suite,Closed Won,23000
D-1028,2026-09-27,Latin America,Diego Costa,Analytics Pro,Closed Won,10500
D-1029,2026-09-28,North America,Noah Williams,Automation Suite,Closed Lost,0
D-1030,2026-09-29,Europe,Sofia Rossi,Automation Suite,Closed Won,20000
D-1031,2026-09-29,APAC,Ethan Tan,Analytics Pro,Closed Won,15000
D-1032,2026-09-30,Latin America,Camila Perez,Team Hub,Closed Lost,0`;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

export function parseSalesCsv(csv: string): Deal[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Add a header row and at least one deal.");

  const headers = parseCsvLine(lines[0]);
  const required = ["Deal_ID", "Close_Date", "Region", "Sales_Rep", "Product", "Deal_Status", "Revenue"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);

  const index = Object.fromEntries(required.map((header) => [header, headers.indexOf(header)]));
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = rowIndex + 2;
    const status = values[index.Deal_Status] as DealStatus;
    const revenue = Number(values[index.Revenue]);
    const closeDate = values[index.Close_Date];
    const textFields = ["Deal_ID", "Region", "Sales_Rep", "Product"] as const;
    const emptyField = textFields.find((field) => !values[index[field]]?.trim());
    if (emptyField) throw new Error(`Row ${row}: ${emptyField} cannot be empty.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closeDate) || Number.isNaN(Date.parse(`${closeDate}T00:00:00Z`))) {
      throw new Error(`Row ${row}: Close_Date must use YYYY-MM-DD.`);
    }
    if (status !== "Closed Won" && status !== "Closed Lost") {
      throw new Error(`Row ${row}: Deal_Status must be Closed Won or Closed Lost.`);
    }
    if (!Number.isFinite(revenue) || revenue < 0) {
      throw new Error(`Row ${row}: Revenue must be a non-negative number.`);
    }
    if (status === "Closed Lost" && revenue !== 0) {
      throw new Error(`Row ${row}: Closed Lost deals must have Revenue equal to 0.`);
    }
    return {
      id: values[index.Deal_ID],
      closeDate,
      region: values[index.Region],
      rep: values[index.Sales_Rep],
      product: values[index.Product],
      status,
      revenue,
    };
  });
}

export const sampleDeals = parseSalesCsv(sampleCsv);

export function aggregateBy(deals: Deal[], key: GroupKey): Aggregate[] {
  const groups = new Map<string, Aggregate>();
  for (const deal of deals) {
    const name = deal[key];
    const current = groups.get(name) ?? { name, revenue: 0, won: 0, total: 0, average: 0 };
    current.total += 1;
    if (deal.status === "Closed Won") {
      current.won += 1;
      current.revenue += deal.revenue;
    }
    groups.set(name, current);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    average: group.won ? group.revenue / group.won : 0,
  }));
}

export function getMetricValue(row: Aggregate, metric: Metric) {
  if (metric === "deals") return row.won;
  return row[metric];
}

export function formatMetric(value: number, metric: Metric) {
  if (metric === "deals") return Math.round(value).toString();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
