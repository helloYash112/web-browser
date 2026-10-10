import { useCallback, useEffect, useState } from "react";
import {
  Activity, ArrowUpRight, Check, CircleAlert, Clock3, Globe2,
  LoaderCircle, LockKeyhole, LogOut, Monitor, Plus, RefreshCw,
  ShieldCheck, Trash2, UserRound, X
} from "lucide-react";

const API_BASE = "/api";

async function apiRequest(path, { token, ...options } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function StatusPill({ status }) {
  const running = status === "running";
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${running ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-emerald-400" : "bg-amber-400"}`} />
    {status || "unknown"}
  </span>;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      // Some registration APIs only create the user. If so, switch to login.
      if (!result.accessToken) {
        if (mode === "register") {
          setMode("login");
          setPassword("");
          setError("Account created if registration succeeded. Please sign in.");
          return;
        }
        throw new Error("Server response did not include accessToken.");
      }
      onAuthenticated(result.accessToken, result.user);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center px-4 py-10">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/30 lg:grid-cols-2">
      <section className="relative hidden min-h-[570px] flex-col justify-between overflow-hidden bg-indigo-600 p-10 lg:flex">
        <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-violet-400/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white/15 p-3"><Globe2 size={25}/></div>
          <div><p className="font-semibold tracking-wide">Browser Platform</p><p className="text-xs text-indigo-100">Secure browser workspace</p></div>
        </div>
        <div className="relative max-w-sm">
          <div className="mb-6 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-indigo-50"><ShieldCheck className="mr-2" size={15}/> Isolated browser sessions</div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Your browser.<br/>Your workspace.</h1>
          <p className="mt-5 leading-7 text-indigo-100">Launch isolated Firefox sessions from one place. Manage your sessions and access them through the platform gateway.</p>
        </div>
        <div className="relative flex items-center gap-2 text-sm text-indigo-100"><LockKeyhole size={16}/> Authenticated access to your sessions</div>
      </section>
      <section className="p-6 sm:p-10 lg:p-12">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="rounded-xl bg-indigo-500/15 p-3 text-indigo-300"><Globe2 size={24}/></div><div><h1 className="font-semibold">Browser Platform</h1><p className="text-xs text-slate-400">Secure browser workspace</p></div></div>
        <p className="text-sm font-medium text-indigo-300">YOUR WORKSPACE</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{mode === "login" ? "Sign in to manage and launch your browser sessions." : "Create an account to get started with your own sessions."}</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div><label className="mb-2 block text-sm text-slate-300">Username</label><div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 focus-within:border-indigo-400/70"><UserRound size={18} className="text-slate-500"/><input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter your username" className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-600"/></div></div>
          <div><label className="mb-2 block text-sm text-slate-300">Password</label><div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 focus-within:border-indigo-400/70"><LockKeyhole size={18} className="text-slate-500"/><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-600"/></div></div>
          {error && <div className="flex gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300"><CircleAlert size={18} className="shrink-0"/><span>{error}</span></div>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">{busy && <LoaderCircle className="animate-spin" size={18}/ >}{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">{mode === "login" ? "New to Browser Platform?" : "Already have an account?"} <button type="button" onClick={()=>{setMode(mode === "login" ? "register" : "login");setError("");}} className="font-medium text-indigo-300 hover:text-indigo-200">{mode === "login" ? "Create an account" : "Sign in"}</button></p>
        <p className="mt-8 text-center text-xs leading-5 text-slate-600">Access is restricted to authenticated users and their own sessions.</p>
      </section>
    </div>
  </main>;
}

function Dashboard({ token, user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [launchLink, setLaunchLink] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await apiRequest("/sessions", { token });
      setSessions(Array.isArray(result.sessions) ? result.sessions : []);
    } catch (err) {
      setError(err.message);
      if (/token|authentication|required/i.test(err.message)) onLogout();
    } finally { setLoading(false); }
  }, [token, onLogout]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function createSession() {
    setCreating(true); setError(""); setNotice(""); setLaunchLink("");
    try {
      const created = await apiRequest("/session", { method: "POST", token });
      setSessions(current => [created, ...current.filter(s => s.sessionId !== created.sessionId)]);
      setNotice("Firefox session created successfully.");
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function openSession(sessionId) {
    setOpeningId(sessionId); setError(""); setNotice(""); setLaunchLink("");
    try {
      const result = await apiRequest(`/session/${encodeURIComponent(sessionId)}/browser-ticket`, { method: "POST", token });
      if (!result.browserUrl) throw new Error("Server did not return a browser launch URL.");
      // The URL includes a one-time ticket. It should be opened immediately.
      const opened = window.open(result.browserUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        setLaunchLink(result.browserUrl);
        setNotice("Your browser blocked the popup. Open the launch link below within 60 seconds.");
      } else {
        setNotice("Browser launch link opened. The launch ticket expires shortly.");
      }
    } catch (err) { setError(err.message); }
    finally { setOpeningId(""); }
  }

  async function deleteSession(sessionId) {
    if (!window.confirm("Close this Firefox session?")) return;
    setDeletingId(sessionId); setError(""); setNotice("");
    try {
      await apiRequest(`/session/${encodeURIComponent(sessionId)}`, { method: "DELETE", token });
      setSessions(current => current.filter(s => s.sessionId !== sessionId));
      setNotice("Browser session closed.");
    } catch (err) { setError(err.message); }
    finally { setDeletingId(""); }
  }

  const runningCount = sessions.filter(s => s.status === "running").length;
  return <div className="min-h-screen">
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3"><div className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-2.5 text-indigo-300"><Globe2 size={23}/></div><div><h1 className="font-semibold tracking-tight">Browser Platform</h1><p className="text-xs text-slate-500">Session dashboard</p></div></div>
      <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-medium">{user?.username || user?.userName || "Your account"}</p><p className="text-xs text-slate-500">Authenticated user</p></div><button onClick={onLogout} title="Sign out" className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:border-rose-400/30 hover:text-rose-300"><LogOut size={18}/></button></div>
    </div></header>
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-slate-900 to-slate-900 p-6 sm:p-9"><div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"/><div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end"><div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300"><Activity size={14}/> Platform dashboard</div><h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Your browser workspace</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Launch isolated Firefox sessions, monitor your workspace, and manage browser lifecycles from one dashboard.</p></div><button onClick={createSession} disabled={creating} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 disabled:opacity-60">{creating ? <LoaderCircle size={18} className="animate-spin"/> : <Plus size={19}/ >}{creating ? "Creating browser..." : "New browser"}</button></div></section>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">Total sessions</span><Monitor className="text-indigo-300" size={19}/></div><p className="mt-4 text-3xl font-semibold">{sessions.length}</p><p className="mt-1 text-xs text-slate-500">Owned by your account</p></div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">Running</span><Activity className="text-emerald-300" size={19}/></div><p className="mt-4 text-3xl font-semibold">{runningCount}</p><p className="mt-1 text-xs text-slate-500">Reported as running</p></div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">Access security</span><ShieldCheck className="text-violet-300" size={19}/></div><p className="mt-4 text-xl font-semibold">JWT protected</p><p className="mt-1 text-xs text-slate-500">Owner-scoped API access</p></div>
      </section>
      {(error || notice) && <div className={`mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${error ? "border-rose-400/20 bg-rose-400/10 text-rose-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{error ? <CircleAlert className="shrink-0" size={18}/> : <Check className="shrink-0" size={18}/>}<div className="min-w-0 flex-1"><p>{error || notice}</p>{launchLink && <a href={launchLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 break-all font-medium underline underline-offset-4">Open browser now <ArrowUpRight size={15}/></a>}</div><button onClick={()=>{setError("");setNotice("");setLaunchLink("");}} aria-label="Dismiss message"><X size={17}/></button></div>}
      <section className="mt-9"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-lg font-semibold">Your browser sessions</h3><p className="mt-1 text-sm text-slate-500">Each session is isolated and accessible only to its owner.</p></div><button onClick={loadSessions} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-60 sm:self-auto"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>Refresh</button></div>
      {loading ? <div className="flex min-h-52 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/40 text-sm text-slate-400"><LoaderCircle className="mr-3 animate-spin" size={19}/>Loading your sessions...</div> : sessions.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/30 px-6 text-center"><div className="rounded-2xl border border-white/10 bg-slate-900 p-4 text-slate-400"><Monitor size={27}/></div><h4 className="mt-4 font-medium">No browser sessions yet</h4><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Create your first Firefox session to start using your workspace.</p><button onClick={createSession} disabled={creating} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-60"><Plus size={17}/>Create browser</button></div> : <div className="grid gap-4 lg:grid-cols-2">{sessions.map(session => <article key={session.sessionId} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition hover:border-white/20"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-3 text-indigo-300"><Monitor size={22}/></div><div className="min-w-0"><h4 className="font-medium">Firefox workspace</h4><p className="mt-1 truncate font-mono text-xs text-slate-500">{session.sessionId}</p></div></div><StatusPill status={session.status}/></div><div className="mt-5 space-y-3 rounded-xl bg-slate-950/60 p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><Clock3 size={15}/>Created {session.createdAt ? new Date(session.createdAt).toLocaleString() : "recently"}</div><div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15}/>Owner-restricted session</div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>openSession(session.sessionId)} disabled={openingId === session.sessionId || ["stopped","missing"].includes(session.status)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">{openingId === session.sessionId ? <LoaderCircle size={16} className="animate-spin"/> : <ArrowUpRight size={16}/>}Open browser</button><button onClick={()=>deleteSession(session.sessionId)} disabled={deletingId === session.sessionId} title="Close browser session" className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 px-4 py-3 text-sm text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-50">{deletingId === session.sessionId ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}<span className="hidden sm:inline">Close</span></button></div></article>)}</div>}
      </section>
      <footer className="mt-12 flex flex-col justify-between gap-3 border-t border-white/10 py-6 text-xs text-slate-600 sm:flex-row"><span>Browser Platform · Session management</span><span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>Connected to API gateway</span></footer>
    </main>
  </div>;
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("browser_platform_token") || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("browser_platform_user") || "null"); }
    catch { return null; }
  });

  const logout = useCallback(() => {
    sessionStorage.removeItem("browser_platform_token");
    sessionStorage.removeItem("browser_platform_user");
    setToken("");
    setUser(null);
  }, []);

  function authenticated(accessToken, userData) {
    sessionStorage.setItem("browser_platform_token", accessToken);
    sessionStorage.setItem("browser_platform_user", JSON.stringify(userData || null));
    setToken(accessToken);
    setUser(userData || null);
  }

  return token ? <Dashboard token={token} user={user} onLogout={logout}/> : <AuthScreen onAuthenticated={authenticated}/>;
}