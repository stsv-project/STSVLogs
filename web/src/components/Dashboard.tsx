import type { ReactNode } from "react";

type Accent = "orange" | "green" | "purple" | "blue" | "red" | "yellow";

export function PageShell({
  title,
  kicker = "STSVLogs",
  subtitle,
  children,
}: {
  title: string;
  kicker?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="page-kicker">{kicker}</p>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </header>
      {children}
    </main>
  );
}

export function StatusBlock({ children }: { children: ReactNode }) {
  return <div className="status-block">{children}</div>;
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <section className="metrics">{children}</section>;
}

export function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: Accent;
}) {
  return (
    <div className={`metric-card${accent ? ` accent-${accent}` : ""}`}>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

export function PanelGrid({ children }: { children: ReactNode }) {
  return <section className="panel-grid">{children}</section>;
}

export function ChartPanel({
  title,
  note,
  span = 6,
  height = 300,
  children,
}: {
  title: string;
  note?: string;
  span?: 4 | 6 | 8 | 12;
  height?: number;
  children: ReactNode;
}) {
  return (
    <article className={`chart-panel panel-span-${span}`}>
      <div className="chart-panel-header">
        <h2 className="chart-title">{title}</h2>
        {note && <span className="chart-note">{note}</span>}
      </div>
      <div className="chart-body" style={{ height }}>
        {children}
      </div>
    </article>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}
