"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  Printer,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  aggregateBy,
  Deal,
  formatMetric,
  getMetricValue,
  GroupKey,
  Metric,
  metricLabels,
  parseSalesCsv,
  sampleCsv,
  sampleDeals,
} from "@/lib/sales";

const groupLabels: Record<GroupKey, string> = {
  region: "Regions",
  rep: "Sales reps",
  product: "Products",
};

const groupIcons = {
  region: BarChart3,
  rep: Users,
  product: BriefcaseBusiness,
};

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>(sampleDeals);
  const [fileName, setFileName] = useState("sample-sales-data.csv");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [group, setGroup] = useState<GroupKey>("region");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    type ToolDefinition = {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    type ModelContext = {
      registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const report = () => undefined;

    void Promise.resolve(
      context.registerTool(
        {
          name: "set_sales_focus_metric",
          title: "Set sales focus metric",
          description: "Change the dashboard focus to revenue, deals closed, or average deal size.",
          inputSchema: {
            type: "object",
            properties: { metric: { type: "string", enum: ["revenue", "deals", "average"] } },
            required: ["metric"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const value = (input as { metric?: unknown })?.metric;
            if (value !== "revenue" && value !== "deals" && value !== "average") {
              throw new Error("Metric must be revenue, deals, or average.");
            }
            setMetric(value);
            return { metric: value, label: metricLabels[value] };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(report);

    void Promise.resolve(
      context.registerTool(
        {
          name: "load_sample_sales_data",
          title: "Load sample sales data",
          description: "Reset the dashboard to its included sample sales dataset.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute() {
            setDeals(sampleDeals);
            setFileName("sample-sales-data.csv");
            setError("");
            return { fileName: "sample-sales-data.csv", dealCount: sampleDeals.length };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(report);

    return () => lifecycle.abort();
  }, []);

  const wonDeals = useMemo(
    () => deals.filter((deal) => deal.status === "Closed Won"),
    [deals],
  );

  const totals = useMemo(() => {
    const revenue = wonDeals.reduce((sum, deal) => sum + deal.revenue, 0);
    return {
      revenue,
      won: wonDeals.length,
      winRate: deals.length ? (wonDeals.length / deals.length) * 100 : 0,
      average: wonDeals.length ? revenue / wonDeals.length : 0,
    };
  }, [deals, wonDeals]);

  const allGroups = useMemo(
    () => ({
      region: aggregateBy(deals, "region"),
      rep: aggregateBy(deals, "rep"),
      product: aggregateBy(deals, "product"),
    }),
    [deals],
  );

  const activeRows = useMemo(() => {
    const rows = allGroups[group];
    const average = rows.length
      ? rows.reduce((sum, row) => sum + getMetricValue(row, metric), 0) / rows.length
      : 0;
    const maximum = rows.length
      ? Math.max(...rows.map((row) => getMetricValue(row, metric)))
      : 0;

    return rows
      .map((row) => ({
        ...row,
        value: getMetricValue(row, metric),
        isTop: getMetricValue(row, metric) === maximum,
        needsAttention: average > 0 && getMetricValue(row, metric) < average * 0.75,
      }))
      .sort((a, b) => b.value - a.value);
  }, [allGroups, group, metric]);

  const topByGroup = useMemo(() => {
    return (Object.keys(allGroups) as GroupKey[]).map((key) => {
      const rows = allGroups[key];
      const maximum = Math.max(0, ...rows.map((row) => getMetricValue(row, metric)));
      return {
        key,
        names: rows
          .filter((row) => getMetricValue(row, metric) === maximum)
          .map((row) => row.name),
        value: maximum,
      };
    });
  }, [allGroups, metric]);

  const attentionItems = useMemo(() => {
    return (Object.keys(allGroups) as GroupKey[]).flatMap((key) => {
      const rows = allGroups[key];
      const average = rows.length
        ? rows.reduce((sum, row) => sum + getMetricValue(row, metric), 0) / rows.length
        : 0;
      return rows
        .filter((row) => average > 0 && getMetricValue(row, metric) < average * 0.75)
        .map((row) => ({ key, name: row.name }));
    });
  }, [allGroups, metric]);

  const dateRange = useMemo(() => {
    if (!deals.length) return "No reporting period";
    const dates = deals.map((deal) => deal.closeDate).sort();
    const format = (date: string) =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00Z`));
    return `${format(dates[0])} – ${format(dates[dates.length - 1])}`;
  }, [deals]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseSalesCsv(await file.text());
      setDeals(parsed);
      setFileName(file.name);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The file could not be read.");
    } finally {
      event.target.value = "";
    }
  }

  function loadSample() {
    setDeals(sampleDeals);
    setFileName("sample-sales-data.csv");
    setError("");
  }

  function downloadSample() {
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample-sales-data.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const maxValue = Math.max(0, ...activeRows.map((row) => row.value));
  const ActiveIcon = groupIcons[group];

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#122235]">
      <header className="border-b border-[#213a55] bg-[#102a43] text-white print:bg-white print:text-[#122235]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[#35d0ba] text-[#102a43] shadow-[0_8px_24px_rgba(53,208,186,0.22)]">
              <TrendingUp aria-hidden="true" className="size-6" />
            </div>
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#8fe5d8]">
                Monthly review
              </p>
              <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
                Sales Performance Insights
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              aria-label="Upload sales CSV"
            />
            <Button
              variant="outline"
              className="border-white/20 bg-white/8 text-white hover:bg-white/15 hover:text-white"
              onClick={() => inputRef.current?.click()}
            >
              <Upload /> Upload CSV
            </Button>
            <Button
              variant="ghost"
              className="text-[#d8e5ef] hover:bg-white/10 hover:text-white"
              onClick={loadSample}
            >
              <RefreshCcw /> Load sample
            </Button>
            <Button
              variant="ghost"
              className="text-[#d8e5ef] hover:bg-white/10 hover:text-white"
              onClick={() => window.print()}
            >
              <Printer /> Print / PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-6 lg:px-8 lg:py-8">
        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#d8e2eb] bg-white p-4 shadow-[0_10px_30px_rgba(16,42,67,0.05)] lg:flex-row lg:items-center lg:justify-between lg:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f8f5] text-[#087f6f]">
              <FileSpreadsheet aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#17324d]">{fileName}</p>
              <p className="text-sm text-[#61758a]">{deals.length} deals · {dateRange}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-lg bg-[#edf5fb] px-3 py-2 text-sm text-[#425f7a]">
              <LockKeyhole aria-hidden="true" className="size-4 text-[#087f6f]" />
              Processed locally in your browser
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-[#425f7a]" htmlFor="metric-select">Focus metric</label>
              <Select value={metric} onValueChange={(value) => setMetric(value as Metric)}>
                <SelectTrigger id="metric-select" className="h-10 w-[190px] border-[#c8d7e3] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="deals">Deals closed</SelectItem>
                  <SelectItem value="average">Average deal size</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-[#efb4a9] bg-[#fff2ef] p-4 text-sm text-[#8e2f21]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div><p className="font-semibold">CSV could not be loaded</p><p>{error}</p></div>
          </div>
        )}

        <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total revenue" value={formatMetric(totals.revenue, "revenue")} detail="Closed-won revenue" icon={TrendingUp} tone="teal" />
          <KpiCard label="Deals closed" value={String(totals.won)} detail={`${deals.length} total opportunities`} icon={Target} tone="blue" />
          <KpiCard label="Win rate" value={`${totals.winRate.toFixed(1)}%`} detail="Closed won ÷ all deals" icon={CheckCircle2} tone="gold" />
          <KpiCard label="Average deal size" value={formatMetric(totals.average, "average")} detail="Across closed-won deals" icon={BriefcaseBusiness} tone="violet" />
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.75fr)]">
          <section className="overflow-hidden rounded-2xl border border-[#d8e2eb] bg-white shadow-[0_10px_30px_rgba(16,42,67,0.05)]">
            <div className="flex flex-col gap-4 border-b border-[#e3eaf0] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div>
                <p className="text-sm font-semibold text-[#087f6f]">Performance comparison</p>
                <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.02em] text-[#17324d]">
                  {metricLabels[metric]} by {groupLabels[group].toLowerCase()}
                </h2>
              </div>
              <Tabs value={group} onValueChange={(value) => setGroup(value as GroupKey)}>
                <TabsList className="h-10 bg-[#edf3f8] p-1">
                  <TabsTrigger value="region" className="px-3">Regions</TabsTrigger>
                  <TabsTrigger value="rep" className="px-3">Sales reps</TabsTrigger>
                  <TabsTrigger value="product" className="px-3">Products</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-0 lg:grid-cols-[minmax(280px,0.85fr)_minmax(420px,1.15fr)]">
              <div className="border-b border-[#e3eaf0] p-5 lg:border-r lg:border-b-0 lg:p-6">
                <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#425f7a]">
                  <ActiveIcon className="size-4" /> Relative performance
                </div>
                <div className="space-y-5">
                  {activeRows.map((row) => (
                    <div key={row.name}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-[#263f57]">{row.name}</span>
                        <span className="shrink-0 font-semibold text-[#17324d]">{formatMetric(row.value, metric)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#e8eef3]">
                        <div
                          className={`h-full rounded-full ${row.isTop ? "bg-[#19aa95]" : row.needsAttention ? "bg-[#e88167]" : "bg-[#4e88b8]"}`}
                          style={{ width: `${maxValue ? Math.max(4, (row.value / maxValue) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2 sm:p-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-3">{group === "rep" ? "Sales rep" : group === "region" ? "Region" : "Product"}</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Won</TableHead>
                      <TableHead className="text-right">Avg. deal</TableHead>
                      <TableHead className="pr-3">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRows.map((row) => (
                      <TableRow key={row.name} className={row.isTop ? "bg-[#eefaf7] hover:bg-[#e7f7f3]" : row.needsAttention ? "bg-[#fff7f4] hover:bg-[#fff1ed]" : ""}>
                        <TableCell className="pl-3 font-medium text-[#263f57]">{row.name}</TableCell>
                        <TableCell className="text-right">{formatMetric(row.revenue, "revenue")}</TableCell>
                        <TableCell className="text-right">{row.won}</TableCell>
                        <TableCell className="text-right">{formatMetric(row.average, "average")}</TableCell>
                        <TableCell className="pr-3">
                          {row.isTop ? <StatusBadge type="top" /> : row.needsAttention ? <StatusBadge type="attention" /> : <span className="text-sm text-[#718397]">On track</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>

          <aside className="overflow-hidden rounded-2xl bg-[#102a43] text-white shadow-[0_16px_36px_rgba(16,42,67,0.18)]">
            <div className="border-b border-white/10 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[#8fe5d8]">
                <Sparkles className="size-5" /><p className="text-sm font-semibold">Executive summary</p>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{metricLabels[metric]} snapshot</h2>
              <p className="mt-2 text-sm leading-6 text-[#c9d7e4]">
                Based on {deals.length} uploaded opportunities. Recommendations are discussion points, not final decisions.
              </p>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <SummaryBlock icon={Trophy} title="Top performers" tone="positive">
                {topByGroup.map((item) => (
                  <p key={item.key}><strong className="text-white">{item.names.join(", ")}</strong> lead {groupLabels[item.key].toLowerCase()} at {formatMetric(item.value, metric)}.</p>
                ))}
              </SummaryBlock>

              <SummaryBlock icon={AlertTriangle} title="Needs attention" tone="warning">
                {attentionItems.length ? (
                  <p>{attentionItems.map((item) => item.name).join(", ")} fall below 75% of their group average for {metricLabels[metric].toLowerCase()}.</p>
                ) : <p>No group is currently below the attention threshold.</p>}
              </SummaryBlock>

              <SummaryBlock icon={Target} title="Discussion points" tone="neutral">
                <p>Review the strongest team’s deal mix, then compare pipeline quality and support needs for flagged areas before changing targets or budgets.</p>
              </SummaryBlock>
            </div>

            <div className="border-t border-white/10 p-5 sm:p-6 print:hidden">
              <Button onClick={downloadSample} className="w-full bg-white text-[#102a43] hover:bg-[#e8f1f6]">
                <Download /> Download sample CSV
              </Button>
            </div>
          </aside>
        </div>

        <footer className="mt-6 flex flex-col gap-2 border-t border-[#d8e2eb] py-5 text-sm text-[#61758a] sm:flex-row sm:items-center sm:justify-between">
          <p>All calculations use closed-won deals unless stated otherwise.</p>
          <p>Attention threshold: below 75% of group average.</p>
        </footer>
      </div>
    </main>
  );
}

function KpiCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof TrendingUp; tone: "teal" | "blue" | "gold" | "violet" }) {
  const tones = {
    teal: "bg-[#e5f8f4] text-[#087f6f]",
    blue: "bg-[#e7f1fa] text-[#326d9d]",
    gold: "bg-[#fff4d8] text-[#9b6b00]",
    violet: "bg-[#f0ebfa] text-[#7052a3]",
  };
  return (
    <article className="rounded-2xl border border-[#d8e2eb] bg-white p-5 shadow-[0_10px_30px_rgba(16,42,67,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-[#61758a]">{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#17324d]">{value}</p></div>
        <div className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><Icon aria-hidden="true" className="size-5" /></div>
      </div>
      <p className="mt-3 text-sm text-[#7a8b9c]">{detail}</p>
    </article>
  );
}

function StatusBadge({ type }: { type: "top" | "attention" }) {
  return type === "top" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#dff5ef] px-2 py-1 text-xs font-semibold text-[#087f6f]"><Trophy className="size-3" /> Top performer</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#ffebe5] px-2 py-1 text-xs font-semibold text-[#a84531]"><AlertTriangle className="size-3" /> Needs attention</span>
  );
}

function SummaryBlock({ icon: Icon, title, tone, children }: { icon: typeof Trophy; title: string; tone: "positive" | "warning" | "neutral"; children: React.ReactNode }) {
  const tones = {
    positive: "bg-[#35d0ba]/12 text-[#8fe5d8]",
    warning: "bg-[#f5a58f]/12 text-[#ffc1af]",
    neutral: "bg-white/8 text-[#d8e5ef]",
  };
  return (
    <div className={`rounded-xl p-4 ${tones[tone]}`}>
      <div className="mb-2 flex items-center gap-2"><Icon className="size-4" /><h3 className="text-sm font-semibold text-white">{title}</h3></div>
      <div className="space-y-2 text-sm leading-6 text-[#d8e5ef]">{children}</div>
    </div>
  );
}
