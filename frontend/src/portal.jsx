import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import {
  SOCKET,
  request,
  statusLabels,
  money,
  date,
  dateTime,
  cls,
} from "./lib.js";
import "./portal.css";

const eventLabels = {
  SUBMITTED: "Claim submitted",
  ASSIGNED: "Assigned to officer",
  STATUS_CHANGED: "Status updated",
  DOCUMENT_UPLOADED: "Document uploaded",
  AI_ASSESSMENT: "AI assessment generated",
};
const track = [
  "NEW",
  "UNDER_REVIEW",
  "APPROVED",
  "SETTLEMENT_IN_PROGRESS",
  "CLOSED",
];

export function Timeline({ items = [] }) {
  const sorted = [...items].sort((a, b) => new Date(a.at) - new Date(b.at));
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Timeline</h3>
          <span>Everything that has happened on this claim</span>
        </div>
      </div>
      {sorted.length ? (
        <ol className="timeline">
          {sorted.map((t) => (
            <li
              key={t._id || t.at + t.event}
              className={t.status ? `tl-${cls(t.status)}` : ""}
            >
              <span className="tl-dot" />
              <div>
                <strong>
                  {eventLabels[t.event] || t.event}
                  {t.status && t.event === "STATUS_CHANGED"
                    ? ` · ${statusLabels[t.status]}`
                    : ""}
                </strong>
                {t.message && <p>{t.message}</p>}
                <small>
                  {t.actor?.name || "System"} · {dateTime(t.at)}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="muted empty-small">No activity yet.</div>
      )}
    </section>
  );
}

function StatusTrack({ status }) {
  const rejected = status === "REJECTED";
  const steps = rejected
    ? ["NEW", "UNDER_REVIEW", "REJECTED", "CLOSED"]
    : track;
  const current =
    status === "ADDITIONAL_INFO_REQUIRED" ? "UNDER_REVIEW" : status;
  const idx = steps.indexOf(current);
  return (
    <div className="track">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`track-step${i < idx ? " done" : ""}${i === idx ? " now" : ""}${rejected && s === "REJECTED" ? " bad" : ""}`}
        >
          <span>{i < idx ? <CheckCircle2 size={15} /> : i + 1}</span>
          {statusLabels[s]}
        </div>
      ))}
      {status === "ADDITIONAL_INFO_REQUIRED" && (
        <div className="track-note">
          <AlertCircle size={15} />
          We need more information — see the timeline and upload documents.
        </div>
      )}
    </div>
  );
}

function ClaimSummary({ c, onOpen }) {
  return (
    <div className="claim-line">
      <div>
        <strong>{c.claimNumber}</strong>
        <span>
          {c.claimType} · {money(c.claimedAmount)} · submitted{" "}
          {date(c.createdAt)}
        </span>
      </div>
      <span className={`status ${cls(c.status)}`}>
        {statusLabels[c.status]}
      </span>
      <button className="secondary" onClick={() => onOpen(c._id)}>
        Open
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

export function CustomerHome({ token, name, onOpen, onNew }) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = async () => {
    try {
      setItems((await request("/api/claims?limit=100", { token })).items);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const s = io(SOCKET, { auth: { token } });
    s.on("dashboard:claimUpdated", load);
    return () => s.disconnect();
  }, [token]);
  const current = items.find((c) => c.status !== "CLOSED");
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">My claims</div>
          <h1>Welcome back, {name}</h1>
          <p>
            Track your current claim and review the history of all your past
            claims.
          </p>
        </div>
        <div className="row-gap">
          <button className="secondary" onClick={load}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="primary" onClick={onNew}>
            <Plus size={16} />
            New claim
          </button>
        </div>
      </section>
      {error && (
        <div className="error-box">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {loading ? (
        <div className="loading">Loading your claims…</div>
      ) : !items.length ? (
        <div className="empty">
          <strong>You have not submitted any claims yet</strong>
          <button className="primary" onClick={onNew}>
            Submit your first claim
          </button>
        </div>
      ) : (
        <>
          {current && (
            <div className="two-col">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Current claim</h3>
                    <span>
                      {current.claimNumber} · {current.claimType}
                    </span>
                  </div>
                  <span className={`status ${cls(current.status)}`}>
                    {statusLabels[current.status]}
                  </span>
                </div>
                <div className="pad">
                  <StatusTrack status={current.status} />
                  <div className="meta-grid">
                    <div>
                      <span>Claimed amount</span>
                      <strong>{money(current.claimedAmount)}</strong>
                    </div>
                    <div>
                      <span>Handled by</span>
                      <strong>
                        {current.assignedOfficerName || "Awaiting assignment"}
                      </strong>
                    </div>
                    <div>
                      <span>Last updated</span>
                      <strong>{date(current.updatedAt)}</strong>
                    </div>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => onOpen(current._id)}
                  >
                    View details and upload documents
                    <ChevronRight size={15} />
                  </button>
                </div>
              </section>
              <Timeline items={current.timeline} />
            </div>
          )}
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>All claims</h3>
                <span>
                  {items.length} claim{items.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div className="claim-list">
              {items.map((c) => (
                <details key={c._id} className="claim-history">
                  <summary>
                    <ClaimSummary c={c} onOpen={onOpen} />
                  </summary>
                  <ol className="timeline compact">
                    {[...(c.timeline || [])]
                      .sort((a, b) => new Date(a.at) - new Date(b.at))
                      .map((t) => (
                        <li key={t._id || t.at + t.event}>
                          <span className="tl-dot" />
                          <div>
                            <strong>
                              {eventLabels[t.event] || t.event}
                              {t.status && t.event === "STATUS_CHANGED"
                                ? ` · ${statusLabels[t.status]}`
                                : ""}
                            </strong>
                            {t.message && <p>{t.message}</p>}
                            <small>
                              {t.actor?.name || "System"} · {dateTime(t.at)}
                            </small>
                          </div>
                        </li>
                      ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function NewClaim({ token, onCreated, onCancel }) {
  const [f, setF] = useState({
      claimType: "MOTOR",
      incidentDate: "",
      incidentDescription: "",
      claimedAmount: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const c = await request("/api/claims", {
        method: "POST",
        token,
        body: { ...f, claimedAmount: Number(f.claimedAmount) },
      });
      onCreated(c);
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Submit a new claim</h3>
          <span>
            It is assigned to a claims officer automatically. You can upload
            supporting documents afterwards.
          </span>
        </div>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Claim type
          <select value={f.claimType} onChange={set("claimType")}>
            {["HEALTH", "MOTOR", "TRAVEL", "PROPERTY"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Incident date
          <input
            required
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={f.incidentDate}
            onChange={set("incidentDate")}
          />
        </label>
        <label>
          Claimed amount (INR)
          <input
            required
            type="number"
            min="1"
            step="any"
            value={f.claimedAmount}
            onChange={set("claimedAmount")}
          />
        </label>
        <label className="wide">
          What happened?
          <textarea
            required
            rows="5"
            value={f.incidentDescription}
            onChange={set("incidentDescription")}
          />
        </label>
        {error && (
          <div className="error-box wide">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        <div className="wide row-gap">
          <button className="primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit claim"}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export function Officers({ token }) {
  const [items, setItems] = useState([]),
    [f, setF] = useState({ name: "", email: "", password: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ok, setOk] = useState("");
  const load = async () => {
    try {
      setItems((await request("/api/users/officers", { token })).items);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const o = await request("/api/users/officers", {
        method: "POST",
        token,
        body: f,
      });
      setOk(`${o.name} can now sign in as a claims officer.`);
      setF({ name: "", email: "", password: "" });
      load();
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">Team</div>
          <h1>Claims officers</h1>
          <p>New claims are assigned to officers in round-robin order.</p>
        </div>
      </section>
      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Add officer</h3>
              <span>Share the password with the officer securely.</span>
            </div>
          </div>
          <form className="form-grid single" onSubmit={submit}>
            <label>
              Full name
              <input required value={f.name} onChange={set("name")} />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={f.email}
                onChange={set("email")}
              />
            </label>
            <label>
              Temporary password
              <input
                required
                type="password"
                minLength="8"
                value={f.password}
                onChange={set("password")}
              />
            </label>
            {error && (
              <div className="error-box">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {ok && (
              <div className="ok-box">
                <CheckCircle2 size={16} />
                {ok}
              </div>
            )}
            <button className="primary" disabled={busy}>
              <UserPlus size={16} />
              {busy ? "Creating…" : "Create officer"}
            </button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Officer roster</h3>
              <span>
                {items.length} officer{items.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="claim-list">
            {items.map((o) => (
              <div className="claim-line" key={o._id}>
                <div>
                  <strong>{o.name}</strong>
                  <span>{o.email}</span>
                </div>
                <span className="type-pill">
                  {o.lastAssignedAt
                    ? `Last assigned ${date(o.lastAssignedAt)}`
                    : "No claims yet"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
