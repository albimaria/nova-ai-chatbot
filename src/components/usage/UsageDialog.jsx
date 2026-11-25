import { useCallback, useEffect, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, RefreshCw, Table2, BarChart3 } from "lucide-react";

import { usageApi } from "../../api/client";
import { Dialog, Spinner } from "../ui/primitives";
import BarChart from "./BarChart";

import "../../styles/usage.css";

const number = new Intl.NumberFormat();
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

const fmt = (value) => (value === null || value === undefined ? "—" : number.format(Math.round(value)));
const fmtCompact = (value) => compact.format(Math.round(value || 0));
const fmtMs = (ms) => (ms === null || ms === undefined ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

function status(ratio) {
  if (ratio >= 0.9) return { level: "critical", label: "Almost out", Icon: AlertOctagon };
  if (ratio >= 0.7) return { level: "warning", label: "Getting close", Icon: AlertTriangle };
  return { level: "good", label: "Healthy", Icon: CheckCircle2 };
}

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  if (!target) return "";
  const minutes = Math.max(0, Math.round((new Date(target).getTime() - now) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function Meter({ used, limit }) {
  if (!limit) return <span className="meter-none">no limit set</span>;
  const ratio = Math.min(used / limit, 1);
  const { level } = status(used / limit);

  return (
    <span
      className="meter"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={used}
      aria-label={`${fmt(used)} of ${fmt(limit)}`}
    >
      <span className={`meter-fill ${level}`} style={{ width: `${Math.max(ratio * 100, used > 0 ? 2 : 0)}%` }} />
    </span>
  );
}

function StatusBadge({ used, limit }) {
  if (!limit) return null;
  const { level, label, Icon } = status(used / limit);
  return (
    <span className={`status-badge ${level}`}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}

function StatTile({ label, value, sub, children }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
      {children}
    </div>
  );
}

function DailyTable({ daily }) {
  return (
    <div className="table-wrap usage-table">
      <table>
        <caption className="sr-only">Daily usage</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Requests</th>
            <th scope="col">Input</th>
            <th scope="col">Output</th>
            <th scope="col">Thinking</th>
            <th scope="col">Total tokens</th>
            <th scope="col">Errors</th>
          </tr>
        </thead>
        <tbody>
          {[...daily].reverse().map((day) => (
            <tr key={day.date}>
              <td>{day.date}</td>
              <td>{fmt(day.requests)}</td>
              <td>{fmt(day.inputTokens)}</td>
              <td>{fmt(day.outputTokens)}</td>
              <td>{fmt(day.thinkingTokens)}</td>
              <td>{fmt(day.totalTokens)}</td>
              <td>{fmt(day.errors)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UsageDialog({ open, onClose }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [asTable, setAsTable] = useState(false);

  const fetchUsage = useCallback(
    () =>
      usageApi
        .get(days)
        .then((result) => {
          setData(result);
          setError(null);
        })
        .catch((err) => setError(err.message)),
    [days]
  );

  const load = () => {
    setRefreshing(true);
    fetchUsage().finally(() => setRefreshing(false));
  };

  // Poll while the dialog is open.
  useEffect(() => {
    if (!open) return undefined;
    fetchUsage();
    const id = window.setInterval(fetchUsage, 20000);
    return () => window.clearInterval(id);
  }, [open, fetchUsage]);

  const countdown = useCountdown(data?.resetsAt);

  // The model that serves most traffic (Fast, Standard, titles) leads the dashboard.
  const primary = data?.models?.find((m) => m.usedBy.includes("Nova Standard")) || data?.models?.[0];

  return (
    <Dialog open={open} onClose={onClose} title="Usage & limits" size="xl">
      {!data && !error && (
        <div className="center-fill">
          <Spinner size={26} />
        </div>
      )}

      {error && !data && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {data && (
        <div className="usage">
          <div className="usage-toolbar">
            <p className="usage-reset">
              Daily Gemini quota resets in <strong>{countdown}</strong>{" "}
              <span>(midnight Pacific time)</span>
            </p>
            <div className="usage-controls">
              <div className="segmented" role="group" aria-label="Time range">
                {[7, 30].map((value) => (
                  <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>
                    {value} days
                  </button>
                ))}
              </div>
              <button type="button" className="icon-btn" onClick={load} aria-label="Refresh usage" title="Refresh">
                <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              </button>
            </div>
          </div>

          {/* KPI row */}
          <div className="kpi-row">
            <StatTile
              label="Gemini requests left today"
              value={primary?.rpdLimit ? fmt(primary.remainingToday) : "—"}
              sub={primary ? `${fmt(primary.requestsToday)} of ${fmt(primary.rpdLimit)} used · ${primary.model}` : null}
            >
              {primary && <Meter used={primary.requestsToday} limit={primary.rpdLimit} />}
            </StatTile>
            <StatTile
              label="Tokens today"
              value={fmtCompact(data.today.totalTokens)}
              sub={`${fmtCompact(data.today.inputTokens)} in · ${fmtCompact(data.today.outputTokens)} out · ${fmtCompact(data.today.thinkingTokens)} thinking`}
            />
            <StatTile
              label="Your messages left"
              value={fmt(data.me.remaining)}
              sub={`${fmt(data.me.messagesLast24h)} of ${fmt(data.me.dailyLimit)} in the last 24 h`}
            >
              <Meter used={data.me.messagesLast24h} limit={data.me.dailyLimit} />
            </StatTile>
            <StatTile
              label="Avg time to first word"
              value={fmtMs(data.today.avgFirstTokenMs)}
              sub={`${fmt(data.today.errors)} errors · ${fmt(data.today.retries)} retries today`}
            />
          </div>

          {/* Meter list: quota per Gemini model */}
          <section className="usage-section">
            <h3>Gemini quota by model</h3>
            <ul className="meter-list">
              {data.models.map((model) => (
                <li key={model.model}>
                  <div className="meter-head">
                    <span className="meter-name">
                      <strong>{model.model}</strong>
                      {model.usedBy.length > 0 && <small>{model.usedBy.join(" · ")}</small>}
                    </span>
                    <StatusBadge used={model.requestsToday} limit={model.rpdLimit} />
                  </div>
                  <div className="meter-row">
                    <span className="meter-label">Today</span>
                    <Meter used={model.requestsToday} limit={model.rpdLimit} />
                    <span className="meter-figure">
                      {fmt(model.requestsToday)} / {fmt(model.rpdLimit)} requests
                    </span>
                  </div>
                  <div className="meter-row">
                    <span className="meter-label">Last minute</span>
                    <Meter used={model.requestsLastMinute} limit={model.rpmLimit} />
                    <span className="meter-figure">
                      {fmt(model.requestsLastMinute)} / {fmt(model.rpmLimit)} requests
                    </span>
                  </div>
                  <div className="meter-row">
                    <span className="meter-label">Tokens / min</span>
                    <Meter used={model.tokensLastMinute} limit={model.tpmLimit} />
                    <span className="meter-figure">
                      {fmtCompact(model.tokensLastMinute)} / {fmtCompact(model.tpmLimit)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Trends */}
          <section className="usage-section">
            <div className="section-head">
              <h3>Last {days} days</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
                {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
                {asTable ? "Show charts" : "Show table"}
              </button>
            </div>

            {asTable ? (
              <DailyTable daily={data.daily} />
            ) : (
              <div className="chart-grid-2">
                <figure className="chart-card">
                  <figcaption>Requests per day <span className="fig-note">(Pacific days)</span></figcaption>
                  <BarChart
                    label="Requests"
                    describe={`${fmt(data.period.requests)} requests in ${days} days`}
                    format={(v) => (v >= 1000 ? fmtCompact(v) : fmt(v))}
                    data={data.daily.map((d) => ({
                      date: d.date,
                      value: d.requests,
                      detail: d.errors ? `${d.errors} errors` : null,
                    }))}
                  />
                </figure>
                <figure className="chart-card">
                  <figcaption>Tokens per day <span className="fig-note">(Pacific days)</span></figcaption>
                  <BarChart
                    label="Tokens"
                    describe={`${fmt(data.period.totalTokens)} tokens in ${days} days`}
                    format={fmtCompact}
                    data={data.daily.map((d) => ({
                      date: d.date,
                      value: d.totalTokens,
                      detail: `${fmtCompact(d.inputTokens)} in · ${fmtCompact(d.outputTokens)} out · ${fmtCompact(d.thinkingTokens)} thinking`,
                    }))}
                  />
                </figure>
              </div>
            )}
          </section>

          {data.isAdmin && data.users && (
            <section className="usage-section">
              <h3>Users ({days} days)</h3>
              <div className="table-wrap usage-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Requests</th>
                      <th scope="col">Tokens</th>
                      <th scope="col">Errors</th>
                      <th scope="col">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((row) => (
                      <tr key={row.email}>
                        <td>{row.name ? `${row.name} · ${row.email}` : row.email}</td>
                        <td>{fmt(row.requests)}</td>
                        <td>{fmt(row.totalTokens)}</td>
                        <td>{fmt(row.errors)}</td>
                        <td>{new Date(row.lastActive).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Recent requests</h3>
              <div className="table-wrap usage-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">User</th>
                      <th scope="col">Type</th>
                      <th scope="col">Model</th>
                      <th scope="col">Tokens</th>
                      <th scope="col">Time taken</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((row, index) => (
                      <tr key={`${row.at}-${index}`}>
                        <td>{new Date(row.at).toLocaleTimeString()}</td>
                        <td>{row.user || "—"}</td>
                        <td>{row.kind}</td>
                        <td>{row.novaModel ? `${row.novaModel} → ${row.geminiModel}` : row.geminiModel}</td>
                        <td>{fmt(row.totalTokens)}</td>
                        <td>{fmtMs(row.latencyMs)}</td>
                        <td>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className="usage-note">
            Token counts come from Gemini's own usage report on every request Nova makes. Google
            doesn't publish remaining quota through its API, so "left" is Nova's count against this
            key's limits (assuming the key is used only by Nova). Updates every 20 seconds.
          </p>
        </div>
      )}
    </Dialog>
  );
}
