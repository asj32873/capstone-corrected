import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
  X,
  BrainCircuit,
  Bell,
} from "lucide-react";
import "./styles.css";
import {
  SOCKET,
  statuses,
  statusLabels,
  roleLabels,
  request,
  money,
  date,
  cls,
} from "./lib.js";
import { Timeline, CustomerHome, NewClaim, Officers } from "./portal.jsx";

const transitions = {
  NEW: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["ADDITIONAL_INFO_REQUIRED", "APPROVED", "REJECTED"],
  ADDITIONAL_INFO_REQUIRED: ["UNDER_REVIEW"],
  APPROVED: ["SETTLEMENT_IN_PROGRESS"],
  REJECTED: ["CLOSED"],
  SETTLEMENT_IN_PROGRESS: ["CLOSED"],
  CLOSED: [],
};

function Login({ onLogin }) {
  const [mode, setMode] = useState("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const register = mode === "register";
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await request(register ? "/auth/register" : "/auth/login", {
          method: "POST",
          body: register ? { name, email, password } : { email, password },
        }),
      );
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-mark">
          <ShieldCheck size={25} />
        </div>
        <div className="eyebrow">Claims operations</div>
        <h1>Claims AI</h1>
        <p className="muted">
          Grounded claim assessment with policy retrieval and human decision
          control.
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Full name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={register ? 8 : undefined}
              required
            />
          </label>
          {error && (
            <div className="error-box">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            <ChevronRight size={17} />
          </button>
        </form>
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(register ? "login" : "register");
            setError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New customer? Create an account"}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(() =>
    JSON.parse(localStorage.getItem("claims_session") || "null"),
  );
  if (!session)
    return (
      <Login
        onLogin={(s) => {
          localStorage.setItem("claims_session", JSON.stringify(s));
          setSession(s);
        }}
      />
    );
  return (
    <Shell
      session={session}
      logout={() => {
        localStorage.removeItem("claims_session");
        setSession(null);
      }}
    />
  );
}

function Shell({ session, logout }) {
  const role = session.user.role,
    customer = role === "CUSTOMER",
    manager = role === "CLAIMS_MANAGER";
  const [view, setView] = useState("dashboard"),
    [selected, setSelected] = useState(null),
    [mobile, setMobile] = useState(false),
    [live, setLive] = useState(false),
    [notifs, setNotifs] = useState(() =>
      JSON.parse(localStorage.getItem("claims_notifs") || "[]"),
    ),
    [bellOpen, setBellOpen] = useState(false);
  useEffect(() => {
    localStorage.setItem("claims_notifs", JSON.stringify(notifs.slice(0, 50)));
  }, [notifs]);
  useEffect(() => {
    const socket = io(SOCKET, { auth: { token: session.token } });
    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    if (manager)
      socket.on("claim:approved", (n) =>
        setNotifs((l) => [
          { ...n, id: crypto.randomUUID(), read: false },
          ...l,
        ]),
      );
    return () => socket.disconnect();
  }, [session.token, manager]);
  const unread = notifs.filter((n) => !n.read).length;
  const openNotif = (n) => {
    setNotifs((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setBellOpen(false);
    openClaim(n.claimId);
  };
  const openClaim = (id) => {
    setSelected(id);
    setView("claim");
    setMobile(false);
  };
  const go = (v) => {
    setView(v);
    setMobile(false);
  };
  const titles = {
    dashboard: customer ? "My claims" : "Dashboard",
    claim: "Claim details",
    policies: "Policy knowledge base",
    new: "New claim",
    officers: "Claims officers",
  };
  const navItem = (v, icon, label) => (
    <button className={view === v ? "nav active" : "nav"} onClick={() => go(v)}>
      {icon}
      {label}
    </button>
  );
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="side-top">
          <div className="brand">
            <div className="brand-mark small">
              <ShieldCheck size={19} />
            </div>
            <div>
              <strong>Claims AI</strong>
              <span>{customer ? "Customer portal" : "Operations Console"}</span>
            </div>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <nav>
          {navItem(
            "dashboard",
            <BarChart3 />,
            customer ? "My claims" : "Dashboard",
          )}
          {customer && navItem("new", <FileText />, "New claim")}
          {!customer && navItem("policies", <Search />, "Policy search")}
          {manager && navItem("officers", <UserRound />, "Officers")}
        </nav>
        <div className="sidebar-bottom">
          <div className="user">
            <div className="avatar">
              {session.user.name?.slice(0, 1) || "U"}
            </div>
            <div>
              <strong>{session.user.name}</strong>
              <span>{roleLabels[role] || role}</span>
            </div>
          </div>
          <button className="nav" onClick={logout}>
            <LogOut />
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div>
            <div className="eyebrow">
              {customer ? "Customer portal" : "Claims workspace"}
            </div>
            <h2>{titles[view]}</h2>
          </div>
          <div className="top-actions">
            {manager && (
              <div className="bell-wrap">
                <button
                  className="icon-btn bell"
                  onClick={() => setBellOpen((o) => !o)}
                  aria-label="Notifications"
                >
                  <Bell />
                  {unread > 0 && <span className="bell-badge">{unread}</span>}
                </button>
                {bellOpen && (
                  <div className="bell-menu">
                    <div className="bell-head">
                      <strong>Approved claims</strong>
                      {unread > 0 && (
                        <button
                          onClick={() =>
                            setNotifs((l) =>
                              l.map((x) => ({ ...x, read: true })),
                            )
                          }
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifs.length === 0 && (
                      <div className="bell-empty">No notifications</div>
                    )}
                    {notifs.map((n) => (
                      <button
                        key={n.id}
                        className={n.read ? "bell-item" : "bell-item unread"}
                        onClick={() => openNotif(n)}
                      >
                        <span>
                          <strong>{n.claimNumber}</strong> approved by{" "}
                          {n.approvedBy}
                        </span>
                        <small>{new Date(n.at).toLocaleString()}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className={live ? "live" : "live off"}>
              <span></span>
              {live ? "Live" : "Offline"}
            </div>
            <div className="user-chip">
              <div className="avatar">
                {session.user.name?.slice(0, 1) || "U"}
              </div>
              {session.user.name}
            </div>
          </div>
        </header>
        <div className="content">
          {view === "dashboard" &&
            (customer ? (
              <CustomerHome
                token={session.token}
                name={session.user.name}
                onOpen={openClaim}
                onNew={() => go("new")}
              />
            ) : (
              <Dashboard
                token={session.token}
                name={session.user.name}
                onOpen={openClaim}
              />
            ))}
          {view === "new" && (
            <NewClaim
              token={session.token}
              onCreated={(c) => openClaim(c._id)}
              onCancel={() => go("dashboard")}
            />
          )}
          {view === "claim" && (
            <ClaimDetail
              token={session.token}
              user={session.user}
              id={selected}
              onBack={() => go("dashboard")}
            />
          )}
          {view === "policies" && <Policies token={session.token} />}
          {view === "officers" && <Officers token={session.token} />}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ token, name, onOpen }) {
  const [data, setData] = useState({ items: [], total: 0 }),
    [filters, setFilters] = useState({ status: "", priority: "", type: "" }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v),
      );
      const d = await request("/api/claims?" + q, { token });
      setData(d);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [filters.status, filters.priority, filters.type]);
  const stats = useMemo(() => {
    const a = data.items;
    return {
      total: data.total,
      new: a.filter((x) => x.status === "NEW").length,
      review: a.filter((x) => x.status === "UNDER_REVIEW").length,
      attention: a.filter((x) => x.status === "ADDITIONAL_INFO_REQUIRED")
        .length,
    };
  }, [data]);
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">Claims overview</div>
          <h1>Welcome back, {name}</h1>
          <p>
            Review incoming claims, retrieve policy context, and generate
            grounded AI assessments.
          </p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </section>
      {error && (
        <div className="error-box">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      <div className="stat-grid">
        <Stat icon={<Activity />} label="Total claims" value={stats.total} />
        <Stat icon={<Clock3 />} label="New" value={stats.new} />
        <Stat
          icon={<BrainCircuit />}
          label="Under review"
          value={stats.review}
        />
        <Stat
          icon={<AlertCircle />}
          label="Need attention"
          value={stats.attention}
        />
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Claims queue</h3>
            <span>{data.total} claims matching your filters</span>
          </div>
          <div className="filters">
            <Filter size={15} />
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">All status</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">All types</option>
              {["HEALTH", "MOTOR", "TRAVEL", "PROPERTY"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: e.target.value })
              }
            >
              <option value="">All priority</option>
              {["LOW", "MEDIUM", "HIGH"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="loading">Loading claims…</div>
        ) : data.items.length === 0 ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Amount</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c._id} onClick={() => onOpen(c._id)}>
                    <td>
                      <strong>{c.claimNumber}</strong>
                      {c.policyNumber && (
                        <span className="sub">{c.policyNumber}</span>
                      )}
                    </td>
                    <td>{c.customerName}</td>
                    <td>
                      <span className="type-pill">{c.claimType}</span>
                    </td>
                    <td>
                      <span className={`status ${cls(c.status)}`}>
                        {statusLabels[c.status]}
                      </span>
                    </td>
                    <td>
                      <span className={`priority ${cls(c.priority)}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td>
                      <strong>{money(c.claimedAmount)}</strong>
                    </td>
                    <td>{date(c.updatedAt)}</td>
                    <td>
                      <ChevronRight size={17} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
function Stat({ icon, label, value }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function Empty() {
  return (
    <div className="empty">
      <FileText size={30} />
      <strong>No claims found</strong>
      <span>Try clearing one or more filters.</span>
    </div>
  );
}

function ClaimDetail({ token, user, id, onBack }) {
  const staff = user.role !== "CUSTOMER";
  const [claim, setClaim] = useState(null),
    [assessment, setAssessment] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [file, setFile] = useState(null),
    [note, setNote] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      setClaim(await request("/api/claims/" + id, { token }));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [id]);
  useEffect(() => {
    if (!id) return;
    const s = io(SOCKET, { auth: { token } });
    s.on("connect", () => s.emit("claim:subscribe", id));
    s.on("claim:statusChanged", (e) => {
      if (e.claimId === id) load();
    });
    return () => {
      s.emit("claim:unsubscribe", id);
      s.disconnect();
    };
  }, [id, token]);
  const status = async (next) => {
    setBusy(true);
    try {
      const c = await request(`/api/claims/${id}/status`, {
        method: "PATCH",
        token,
        body: { status: next, note: note.trim() || undefined },
      });
      setClaim(c);
      setNote("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const assess = async () => {
    setBusy(true);
    setError("");
    try {
      setAssessment(
        await request(`/api/claims/${id}/generate-assessment`, {
          method: "POST",
          token,
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const download = async (docId) => {
    try {
      const { url } = await request(
        `/api/claims/${id}/documents/${docId}/download`,
        { token },
      );
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const f = new FormData();
      f.append("document", file);
      const d = await request(`/api/claims/${id}/documents`, {
        method: "POST",
        token,
        body: f,
      });
      setClaim(await request("/api/claims/" + id, { token }));
      setFile(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <div className="loading">Loading claim…</div>;
  if (!claim) return <div className="error-box">Claim not found</div>;
  const allowed = (transitions[claim.status] || []).filter(
    (s) =>
      user.role === "CLAIMS_MANAGER" ||
      (s !== "SETTLEMENT_IN_PROGRESS" &&
        !(s === "CLOSED" && claim.status === "SETTLEMENT_IN_PROGRESS")),
  );
  return (
    <>
      <button className="back" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to claims
      </button>
      <section className="claim-heading">
        <div>
          <div className="eyebrow">{claim.claimType} claim</div>
          <h1>{claim.claimNumber}</h1>
          <p>
            {claim.customerName}
            {claim.policyNumber ? ` · Policy ${claim.policyNumber}` : ""}
          </p>
        </div>
        <div className="heading-status">
          <span className={`status ${cls(claim.status)}`}>
            {statusLabels[claim.status]}
          </span>
          <span className={`priority ${cls(claim.priority)}`}>
            {claim.priority} priority
          </span>
        </div>
      </section>
      {error && (
        <div className="error-box">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      <div className="detail-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Claim information</h3>
                <span>Core incident and financial details</span>
              </div>
            </div>
            <div className="info-grid">
              <Info label="Incident date" value={date(claim.incidentDate)} />
              <Info label="Claimed amount" value={money(claim.claimedAmount)} />
              <Info label="Customer" value={claim.customerName} />
              {claim.policyNumber && (
                <Info label="Policy" value={claim.policyNumber} />
              )}
              <Info
                label="Assigned officer"
                value={claim.assignedOfficerName || "Unassigned"}
              />
            </div>
            <div className="description">
              <span>Incident description</span>
              <p>{claim.incidentDescription || "No description provided."}</p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Documents</h3>
                <span>Supporting files attached to this claim</span>
              </div>
            </div>
            <div className="upload-row">
              <label className="file-picker">
                <Upload size={17} />
                {file ? file.name : "Choose document"}
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                className="primary"
                disabled={!file || busy}
                onClick={upload}
              >
                Upload
              </button>
            </div>
            {(claim.supportingDocuments || []).length ? (
              <div className="doc-list">
                {claim.supportingDocuments.map((d) => (
                  <div className="doc" key={d._id || d.storedName}>
                    <FileText size={18} />
                    <div>
                      <strong>{d.originalName}</strong>
                      <span>
                        {Math.round((d.size || 0) / 1024)} KB ·{" "}
                        {date(d.uploadedAt)}
                      </span>
                    </div>
                    {staff && (
                      <button type="button" onClick={() => download(d._id)}>
                        Download
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted empty-small">No documents uploaded.</div>
            )}
          </section>
        </div>
        <div className="stack">
          {staff && (
            <section className="panel ai-panel">
              <div className="panel-head">
                <div>
                  <h3>
                    <BrainCircuit size={18} /> AI assessment
                  </h3>
                  <span>
                    Advisory only — final decision remains with the claims
                    officer.
                  </span>
                </div>
                <button className="primary" onClick={assess} disabled={busy}>
                  {busy ? "Working…" : "Generate assessment"}
                </button>
              </div>
              {assessment?.assessment ? (
                <Assessment data={assessment} />
              ) : (
                <div className="ai-empty">
                  <BrainCircuit size={30} />
                  <strong>Generate a grounded assessment</strong>
                  <span>
                    The AI service retrieves relevant policy context before
                    assessing the claim.
                  </span>
                </div>
              )}
            </section>
          )}
          {staff && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Workflow</h3>
                  <span>
                    Allowed next statuses are enforced by the backend.
                  </span>
                </div>
              </div>
              <div className="workflow">
                <input
                  className="note"
                  placeholder="Optional note shown on the claim timeline"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="current">
                  <span>Current status</span>
                  <strong>{statusLabels[claim.status]}</strong>
                </div>
                <div className="next-list">
                  {allowed.map((s) => (
                    <button
                      key={s}
                      className="status-action"
                      disabled={busy}
                      onClick={() => status(s)}
                    >
                      {statusLabels[s]}
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
                {!allowed.length && (
                  <span className="muted">
                    No further workflow transition is available to you.
                  </span>
                )}
              </div>
            </section>
          )}
          <Timeline items={claim.timeline} />
        </div>
      </div>
    </>
  );
}
function Info({ label, value }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Assessment({ data }) {
  const a = data.assessment;
  const effectLabels = {
    SUPPORTS_ACCEPTANCE: "Supports acceptance",
    SUPPORTS_REJECTION: "Supports rejection",
    NEEDS_REVIEW: "Needs review",
  };
  return (
    <div className="assessment">
      <div className="summary">
        <span>Summary</span>
        <p>{a.summary}</p>
      </div>
      <div className="assessment-section">
        <span>Relevant policy conditions</span>
        {(a.relevantConditions || []).map((x, i) => (
          <div className="condition" key={i}>
            <strong>{x.reference}</strong>
            <div>
              <b>{effectLabels[x.effect] || "Policy condition"}</b>
              <p>
                <q>{x.condition}</q>
              </p>
              <p>{x.relevance}</p>
            </div>
          </div>
        ))}
        {!a.relevantConditions?.length && (
          <p>No relevant policy conditions identified.</p>
        )}
        {data.policyReferences?.map((r) => (
          <div className="reference" key={r.reference}>
            <strong>{r.reference}</strong>
            <p>
              {r.metadata?.title ||
                r.metadata?.product ||
                "Retrieved policy context"}
            </p>
            <small>{r.excerpt}</small>
          </div>
        ))}
      </div>
      <div className="assessment-section">
        <span>Missing information</span>
        {(a.missingInformation || []).map((x, i) => (
          <div className="bullet" key={i}>
            <AlertCircle size={14} />
            {x}
          </div>
        ))}
        {!a.missingInformation?.length && (
          <p>No missing information identified.</p>
        )}
      </div>
      <div className="next-action">
        <span>Recommended action</span>
        <strong>{a.recommendedNextAction}</strong>
      </div>
      <div className="authority">
        <CheckCircle2 size={15} />
        Decision authority: {a.decisionAuthority || "Claims officer"}
      </div>
    </div>
  );
}

function Policies({ token }) {
  const [q, setQ] = useState(""),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const search = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError("");
    try {
      const d = await request(
        "/api/policies/search?q=" + encodeURIComponent(q) + "&k=10",
        { token },
      );
      setResults(d.results || []);
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
          <div className="eyebrow">Knowledge base</div>
          <h1>Policy search</h1>
          <p>
            Search the indexed insurance products used by the assessment
            workflow.
          </p>
        </div>
      </section>
      <section className="panel search-panel">
        <form onSubmit={search}>
          <Search size={19} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search coverage, exclusions, limits, claim conditions…"
          />
          <button className="primary" disabled={busy}>
            {busy ? "Searching…" : "Search"}
          </button>
        </form>
        {error && (
          <div className="error-box">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </section>
      <section className="results">
        {results.map((r, i) => (
          <article className="result-card" key={i}>
            <div className="result-top">
              <div>
                <span className="type-pill">
                  {r.metadata?.claimType || "POLICY"}
                </span>
                <h3>
                  {r.metadata?.title ||
                    r.metadata?.product ||
                    `Policy result ${i + 1}`}
                </h3>
              </div>
              <span className="distance">
                Distance{" "}
                {typeof r.distance === "number" ? r.distance.toFixed(3) : "—"}
              </span>
            </div>
            <p>{r.document}</p>
            <div className="result-meta">
              <span>{r.metadata?.product || "Insurance product"}</span>
              <span>{r.metadata?.source || "Knowledge base"}</span>
            </div>
          </article>
        ))}
        {!results.length && !busy && (
          <div className="empty">
            <Search size={30} />
            <strong>Search policy knowledge</strong>
            <span>Enter a query to retrieve relevant policy context.</span>
          </div>
        )}
      </section>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
