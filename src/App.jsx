import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, CalendarDays,
  Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Cloud, Flame, Leaf, LayoutDashboard, ListChecks, LogOut, Menu, Moon,
  MoreHorizontal, Pencil, Plus, Settings, ShieldCheck, Sparkles, Sun,
  Target, Trash2, TrendingUp, Trophy, UserRound, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, startOfMonth, startOfWeek, subDays, subMonths, addMonths
} from "date-fns";
import { isSupabaseConfigured, supabase } from "./supabase";

const DEFAULT_HABITS = [
  { name: "Wake up on time", category: "Mindfulness", emoji: "🌤️", color: "#f4b942", target: "Build a calm morning" },
  { name: "Exercise / walk", category: "Health", emoji: "💪", color: "#36a56c", target: "Move for 20–30 minutes" },
  { name: "Focused study", category: "Learning", emoji: "📚", color: "#5798e8", target: "One distraction-free session" },
  { name: "Coding practice", category: "Career", emoji: "💻", color: "#8d7ce8", target: "Build or improve something" },
  { name: "English speaking", category: "Learning", emoji: "🎙️", color: "#e879b7", target: "Speak aloud for 10 minutes" },
  { name: "Read a book", category: "Learning", emoji: "📖", color: "#2eaaa5", target: "Read for 15 minutes" },
  { name: "Drink enough water", category: "Health", emoji: "💧", color: "#49b8df", target: "Stay hydrated throughout the day" },
  { name: "Plan tomorrow", category: "Productivity", emoji: "🗓️", color: "#e9a14b", target: "Write tomorrow’s top 3 tasks" },
  { name: "Meditate", category: "Mindfulness", emoji: "🧘", color: "#8b83d9", target: "Take 5 quiet minutes to reset" },
  { name: "Get enough sleep", category: "Health", emoji: "🌙", color: "#6d9fe6", target: "Aim for a consistent bedtime" },
  { name: "Write in a journal", category: "Mindfulness", emoji: "📝", color: "#c77dbb", target: "Reflect on one thing from today" },
  { name: "Take a screen break", category: "Health", emoji: "🌱", color: "#63ad7c", target: "Step away from screens for 10 minutes" }
];

const PARTICIPANT_USERNAMES = ["Harish", "SHYAM"];
const AUTH_EMAIL_DOMAIN = "winterarc.invalid";
const PALETTE = ["#25865a", "#63ad7c", "#e8b34b", "#6d9fe6", "#c77dbb", "#48aaa3", "#e78b63", "#8b83d9"];
const today = new Date();

function usernameToAuthEmail(username) {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

function localDateKey(date) {
  return format(date, "yyyy-MM-dd");
}
function getInitials(name = "") {
  return name.split(/[ @._-]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join("") || "HG";
}
function safeName(user) {
  return user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
}
function percent(done, total) {
  return total ? Math.round((done / total) * 100) : 0;
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loadingData, setLoadingData] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [activeView, setActiveView] = useState("Dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [habitForm, setHabitForm] = useState({ name: "", category: "Personal", emoji: "✨", target: "", cadence: "daily", weekly_target: 3 });
  const [members, setMembers] = useState([]);
  const [habitError, setHabitError] = useState("");
  const [toast, setToast] = useState("");

  const user = session?.user || null;
  const demoMode = !isSupabaseConfigured;

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthError(error.message);
      setSession(data?.session || null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      setAuthError("");
    });
    return () => {
      alive = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setAuthError("");
    const [habitResult, completionResult, memberResult] = await Promise.all([
      supabase.from("habits").select("*").order("created_at", { ascending: true }),
      supabase.from("habit_completions").select("*"),
      supabase.from("challenge_members").select("user_id, display_name")
    ]);
    if (habitResult.error || completionResult.error || memberResult.error) {
      setAuthError(habitResult.error?.message || completionResult.error?.message || memberResult.error?.message || "Could not load your data.");
      setLoadingData(false);
      return;
    }
    setMembers(memberResult.data || []);
    let fetchedHabits = habitResult.data || [];
    if (!fetchedHabits.length) {
      const rows = DEFAULT_HABITS.map((h, i) => ({
        user_id: user.id, name: h.name, category: h.category, emoji: h.emoji,
        color: h.color || PALETTE[i % PALETTE.length], target: h.target,
        cadence: "daily", weekly_target: 7, active: true, sort_order: i
      }));
      const { data, error } = await supabase.from("habits").insert(rows).select("*");
      if (error) {
        setAuthError(`Could not create the starter habits: ${error.message}`);
        setLoadingData(false);
        return;
      }
      fetchedHabits = data || [];
    }
    setHabits(fetchedHabits);
    const map = {};
    (completionResult.data || []).forEach(row => {
      map[`${row.habit_id}:${row.completion_date}`] = Boolean(row.completed);
    });
    setCompletions(map);
    setLoadingData(false);
  }, [user]);

  useEffect(() => {
    if (user) loadData();
    else if (demoMode) {
      const seeded = DEFAULT_HABITS.map((h, i) => ({
        ...h, id: `demo-${i + 1}`, active: true, sort_order: i
      }));
      setHabits(seeded);
      const seed = {};
      for (let d = 1; d <= today.getDate(); d++) {
        seeded.forEach((h, i) => {
          if ((d * (i + 3) + i) % 7 < 4 && d <= today.getDate()) {
            seed[`${h.id}:${localDateKey(new Date(today.getFullYear(), today.getMonth(), d))}`] = true;
          }
        });
      }
      setCompletions(seed);
    }
  }, [user, demoMode, loadData]);

  const activeHabits = useMemo(() => habits.filter(h => h.active !== false), [habits]);
  const myHabits = useMemo(() => activeHabits.filter(h => !user || h.user_id === user.id), [activeHabits, user]);
  const partnerHabits = useMemo(() => activeHabits.filter(h => user && h.user_id && h.user_id !== user.id), [activeHabits, user]);
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const isDone = useCallback((habitId, date) => Boolean(completions[`${habitId}:${localDateKey(date)}`]), [completions]);
  const countOnDate = useCallback((date) => activeHabits.filter(h => isDone(h.id, date)).length, [activeHabits, isDone]);

  const monthStats = useMemo(() => {
    let done = 0;
    let possible = 0;
    const perHabit = activeHabits.map(h => {
      let habitDone = 0;
      monthDays.forEach(day => {
        if (day <= today && isDone(h.id, day)) habitDone++;
      });
      const elapsedDays = monthDays.filter(day => day <= today).length;
      return { ...h, done: habitDone, total: elapsedDays, rate: percent(habitDone, elapsedDays) };
    });
    monthDays.forEach(day => {
      if (day <= today) {
        possible += activeHabits.length;
        done += countOnDate(day);
      }
    });
    const elapsed = monthDays.filter(day => day <= today).length;
    return { done, possible, rate: percent(done, possible), perHabit, elapsed };
  }, [activeHabits, monthDays, isDone, countOnDate]);

  const weekData = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => {
      const end = subDays(today, i * 7);
      const start = subDays(end, 6);
      let done = 0, possible = 0;
      eachDayOfInterval({ start, end }).forEach(day => {
        if (day <= today) { done += countOnDate(day); possible += activeHabits.length; }
      });
      return { week: i === 0 ? "This week" : `${i} wk${i > 1 ? "s" : ""} ago`, rate: percent(done, possible), done, possible };
    }).reverse();
  }, [countOnDate, activeHabits.length]);

  const dailyTrend = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const day = subDays(today, 13 - i);
      return { day: format(day, "MMM d"), completed: countOnDate(day), rate: percent(countOnDate(day), activeHabits.length) };
    });
  }, [countOnDate, activeHabits.length]);

  const streak = useMemo(() => {
    let days = 0;
    let cursor = today;
    // If today is not yet complete, allow the streak to continue from yesterday.
    if (activeHabits.length && countOnDate(cursor) === 0) cursor = subDays(cursor, 1);
    while (days < 366 && activeHabits.length && countOnDate(cursor) > 0) {
      days++;
      cursor = subDays(cursor, 1);
    }
    return days;
  }, [activeHabits, countOnDate]);

  const pieData = useMemo(() => {
    return monthStats.perHabit.filter(h => h.rate > 0).map((h, i) => ({ name: h.name, value: h.rate, color: h.color || PALETTE[i % PALETTE.length] }));
  }, [monthStats.perHabit]);

  async function submitAuth(e) {
    e.preventDefault();
    setAuthBusy(true); setAuthError(""); setAuthMessage("");
    try {
      const login = email.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);
      const isUsername = /^[a-zA-Z0-9._-]{3,32}$/.test(login);
      if (!isEmail && !isUsername) {
        throw new Error("Enter a valid email address or a username (3–32 letters, numbers, dots, underscores, or hyphens).");
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: isEmail ? login : usernameToAuthEmail(login),
        password
      });
      if (error) throw error;
    } catch (error) {
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (demoMode) { showToast("Demo mode is active — connect Supabase to use accounts."); return; }
    await supabase.auth.signOut();
    setHabits([]); setCompletions({});
    setActiveView("Dashboard");
  }

  async function toggleCompletion(habit, date) {
    const key = `${habit.id}:${localDateKey(date)}`;
    const next = !completions[key];
    setCompletions(prev => ({ ...prev, [key]: next }));
    if (!user) {
      showToast("Preview only. Connect Supabase to save across devices.");
      return;
    }
    setSaveState("saving");
    const { error } = await supabase.from("habit_completions").upsert({
      user_id: habit.user_id || user.id, habit_id: habit.id, completion_date: localDateKey(date), completed: next
    }, { onConflict: "habit_id,completion_date" });
    if (error) {
      setCompletions(prev => ({ ...prev, [key]: !next }));
      setAuthError(error.message);
      setSaveState("error");
    } else {
      setSaveState("saved");
    }
  }

  function openAddHabit() {
    setEditingHabit(null);
    setHabitForm({ name: "", category: "Personal", emoji: "✨", target: "", cadence: "daily", weekly_target: 3 });
    setHabitError("");
    setModalOpen(true);
  }
  function openEditHabit(habit) {
    setEditingHabit(habit);
    setHabitForm({ name: habit.name, category: habit.category || "Personal", emoji: habit.emoji || "✨", target: habit.target || "", cadence: habit.cadence || "daily", weekly_target: habit.weekly_target || 3 });
    setHabitError("");
    setModalOpen(true);
  }
  async function saveHabit(e) {
    e.preventDefault();
    const name = habitForm.name.trim();
    if (!name) { setHabitError("Add a name for your habit."); return; }
    if (habits.some(h => (h.user_id === user?.id || !user) && h.name.toLowerCase() === name.toLowerCase() && h.id !== editingHabit?.id)) {
      setHabitError("You already have a habit with that name."); return;
    }
    const payload = {
      name, category: habitForm.category, emoji: habitForm.emoji || "✨",
      target: habitForm.target.trim(), cadence: habitForm.cadence || "daily", weekly_target: habitForm.cadence === "weekly" ? Number(habitForm.weekly_target || 3) : 7, color: editingHabit?.color || PALETTE[habits.length % PALETTE.length],
      active: true, sort_order: editingHabit?.sort_order ?? habits.length
    };
    if (!user) {
      if (editingHabit) setHabits(prev => prev.map(h => h.id === editingHabit.id ? { ...h, ...payload } : h));
      else setHabits(prev => [...prev, { ...payload, id: `demo-${Date.now()}` }]);
      setModalOpen(false); showToast("Updated preview habit."); return;
    }
    setSaveState("saving");
    const result = editingHabit
      ? await supabase.from("habits").update(payload).eq("id", editingHabit.id).eq("user_id", user.id).select().single()
      : await supabase.from("habits").insert({ ...payload, user_id: user.id }).select().single();
    if (result.error) { setHabitError(result.error.message); setSaveState("error"); return; }
    if (editingHabit) setHabits(prev => prev.map(h => h.id === editingHabit.id ? result.data : h));
    else setHabits(prev => [...prev, result.data]);
    setModalOpen(false); setSaveState("saved"); showToast(editingHabit ? "Habit updated." : "Habit added.");
  }
  async function deleteHabit(habit) {
    if (!window.confirm(`Delete “${habit.name}” and its completion history?`)) return;
    if (user) {
      const { error } = await supabase.from("habits").delete().eq("id", habit.id).eq("user_id", user.id);
      if (error) { setAuthError(error.message); return; }
    }
    setHabits(prev => prev.filter(h => h.id !== habit.id));
    setCompletions(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(`${habit.id}:`))));
    showToast("Habit deleted.");
  }
  async function toggleHabitActive(habit) {
    const active = habit.active === false;
    if (user) {
      const { error } = await supabase.from("habits").update({ active }).eq("id", habit.id).eq("user_id", user.id);
      if (error) { setAuthError(error.message); return; }
    }
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, active } : h));
  }

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "My Habits", icon: ListChecks },
    { label: "Calendar", icon: CalendarDays },
    { label: "Statistics", icon: BarChart3 },
    { label: "Settings", icon: Settings }
  ];

  if (authLoading) return <div className="auth-loading"><div className="brand-mark"><Leaf size={24}/></div><span>Preparing your WinterArc space…</span></div>;

  if (isSupabaseConfigured && !session) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} fullName={fullName} setFullName={setFullName} submitAuth={submitAuth} busy={authBusy} error={authError} message={authMessage} />;
  }

  return (
    <div className={`app-shell ${darkMode ? "dark" : ""}`}>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Leaf size={23} fill="currentColor" /></div>
          <div><div className="brand-name">WinterArc Challenge</div><div className="brand-subtitle">Two people. One shared challenge.</div></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={19}/></button>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.label} className={`nav-item ${activeView === item.label ? "active" : ""}`} onClick={() => { setActiveView(item.label); setMobileNavOpen(false); }}>
              <Icon size={19}/><span>{item.label}</span>{item.label === "My Habits" && <span className="nav-count">{activeHabits.length}</span>}
            </button>;
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="quote-card">
          <div className="quote-leaf"><Sparkles size={19}/></div>
          <p>Small steps every day lead to big results.</p>
          <span>YOUR DAILY REMINDER</span>
          <div className="quote-illustration"><span/><span/><span/><span/><span/></div>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{getInitials(user ? safeName(user) : "WinterArc Challenge")}</div>
          <div className="user-meta"><strong>{user ? safeName(user) : "Preview account"}</strong><span>{user ? `@${safeName(user)}` : "Sample data"}</span></div>
          <button className="icon-button" title="Sign out" onClick={signOut}><LogOut size={17}/></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={22}/></button>
            <div className="greeting-icon">{activeView === "Dashboard" ? <Sun size={25}/> : <Leaf size={23}/>}</div>
            <div>
              <h1>{activeView === "Dashboard" ? `Good ${today.getHours() < 12 ? "morning" : today.getHours() < 18 ? "afternoon" : "evening"}, ${user ? safeName(user).split(" ")[0] : "Harish"}!` : activeView}</h1>
              <p>{activeView === "Dashboard" ? "Build the habits that build your future." : viewSubtitle(activeView)}</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="month-picker">
              <CalendarDays size={17}/>
              <input aria-label="Select month" type="month" value={format(selectedMonth, "yyyy-MM")} onChange={e => { if (e.target.value) setSelectedMonth(startOfMonth(new Date(`${e.target.value}-01T12:00:00`))); }}/>
              <ChevronDown size={15}/>
            </div>
            <button className="theme-toggle" onClick={() => setDarkMode(v => !v)} aria-label="Toggle dark mode">{darkMode ? <Moon size={17}/> : <Sun size={17}/>}</button>
            <button className="avatar top-avatar" title="Account">{getInitials(user ? safeName(user) : "Harish")}</button>
          </div>
        </header>

        {demoMode && <div className="demo-banner"><Sparkles size={16}/><span><strong>Interactive preview</strong> — sample data is shown. Configure Supabase to create an account and sync your habits across devices.</span><button onClick={() => document.getElementById("setup-note")?.scrollIntoView({ behavior: "smooth" })}>Setup guide <ChevronRight size={15}/></button></div>}
        {user && <section className="winter-challenge-strip"><div className="winter-challenge-heading"><span className="winter-challenge-symbol"><Trophy size={18}/></span><div><strong>Two-person challenge</strong><small>{members.length ? `${members.length} authorized participants · shared progress` : "Apply the WinterArc shared-challenge SQL setup"}</small></div></div><div className="winter-challenge-people">{(members.length ? members : [{user_id:user.id,display_name:safeName(user)}]).slice(0,2).map((m,i)=><div className="winter-challenge-person" key={m.user_id}><span className={`participant-avatar ${i===1?"second":""}`}>{getInitials(m.display_name)}</span><span><strong>{m.display_name}</strong><small>{habits.filter(h=>h.user_id===m.user_id).length} habits · {habits.filter(h=>h.user_id===m.user_id && h.active!==false && isDone(h.id,today)).length} done today</small></span></div>)}</div></section>}
        {authError && <div className="inline-alert"><CircleHelp size={17}/><span>{authError}</span><button onClick={() => setAuthError("")}><X size={16}/></button></div>}

        {activeView === "Dashboard" && <DashboardView
          activeHabits={activeHabits} habits={habits} monthStats={monthStats} selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth} monthDays={monthDays} selectedDay={selectedDay} setSelectedDay={setSelectedDay}
          isDone={isDone} countOnDate={countOnDate} toggleCompletion={toggleCompletion}
          weekData={weekData} dailyTrend={dailyTrend} pieData={pieData} streak={streak}
          openAddHabit={openAddHabit} openEditHabit={openEditHabit} loadingData={loadingData} user={user} members={members}
          saveState={saveState} isSameMonth={isSameMonth}
        />}
        {activeView === "My Habits" && <HabitsView habits={habits} currentUserId={user?.id} members={members} isDone={isDone} selectedDay={selectedDay} setSelectedDay={setSelectedDay} toggleCompletion={toggleCompletion} openAddHabit={openAddHabit} openEditHabit={openEditHabit} deleteHabit={deleteHabit} toggleHabitActive={toggleHabitActive}/>}
        {activeView === "Calendar" && <CalendarView selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} monthDays={monthDays} selectedDay={selectedDay} setSelectedDay={setSelectedDay} activeHabits={activeHabits} countOnDate={countOnDate} isDone={isDone} toggleCompletion={toggleCompletion}/>}
        {activeView === "Statistics" && <StatisticsView monthStats={monthStats} weekData={weekData} dailyTrend={dailyTrend} pieData={pieData} activeHabits={activeHabits} selectedMonth={selectedMonth}/>}
        {activeView === "Settings" && <SettingsView user={user} darkMode={darkMode} setDarkMode={setDarkMode} signOut={signOut} demoMode={demoMode}/>}
        <footer className="footer"><span>© {new Date().getFullYear()} WinterArc Challenge</span><span><ShieldCheck size={14}/> Your progress, your pace.</span><span className={`save-indicator ${saveState}`}><span className="save-dot"/>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save error" : "All changes saved"}</span></footer>
      </main>

      {modalOpen && <HabitModal form={habitForm} setForm={setHabitForm} onSave={saveHabit} onClose={() => setModalOpen(false)} error={habitError} editing={Boolean(editingHabit)}/>}
      {toast && <div className="toast"><CheckCircleIcon/><span>{toast}</span></div>}
      <div id="setup-note" className="setup-anchor" />
    </div>
  );
}

function viewSubtitle(view) {
  return ({
    "My Habits": "Shape a routine that works for you.",
    "Calendar": "See your consistency one day at a time.",
    "Statistics": "Notice your progress and celebrate small wins.",
    "Settings": "Make your WinterArc space feel like yours."
  })[view] || "";
}
function CheckCircleIcon() { return <span className="toast-check"><Check size={14}/></span>; }

function AuthScreen({ mode, setMode, email, setEmail, password, setPassword, fullName, setFullName, submitAuth, busy, error, message }) {
  return <div className="auth-page winter-auth-page">
    <div className="auth-art winter-auth-art">
      <div className="auth-brand"><div className="brand-mark"><Sparkles size={23}/></div><span>WinterArc <b>Challenge</b></span></div>
      <div className="auth-art-content"><div className="auth-sparkle"><Sparkles size={22}/></div><div className="winter-kicker">THE CONSISTENCY CHALLENGE</div><h1>Small steps.<br/><em>Stronger seasons.</em></h1><p>A focused space for two participants to build better routines, keep their promises, and make progress visible—one day at a time.</p>
        <div className="winter-participants">{PARTICIPANT_USERNAMES.map((name, index) => <div className="winter-participant" key={name}><span className={`participant-avatar ${index === 1 ? "second" : ""}`}>{getInitials(name)}</span><span><strong>{name}</strong><small>Personal progress</small></span></div>)}</div>
        <div className="winter-auth-note"><ShieldCheck size={16}/><span>Private sign-in · Built for two participants</span></div>
      </div>
      <div className="auth-art-bottom"><span/><span/><span/><span/><span/><span/><span/></div>
    </div>
    <div className="auth-panel winter-auth-panel"><div className="auth-form-wrap">
      <div className="mobile-auth-brand"><div className="brand-mark"><Sparkles size={21}/></div><strong>WinterArc Challenge</strong></div>
      <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
      <h2>Welcome back</h2>
      <p className="auth-lede">Sign in to continue your habits and track your WinterArc progress.</p>
      <div className="winter-profile-prompt"><span className="winter-profile-icon"><UserRound size={18}/></span><span><strong>Sign in with username or email</strong><small>Only the two configured participant accounts can access this challenge.</small></span></div>
      <div className="winter-profile-cards">{PARTICIPANT_USERNAMES.map((name, index) => <div className="winter-profile-card" key={name}><span className={`participant-avatar ${index === 1 ? "second" : ""}`}>{getInitials(name)}</span><span><strong>{name}</strong><small>Enter username or account email</small></span><ChevronRight size={17}/></div>)}</div>
      <form onSubmit={submitAuth} className="auth-form">
        <label>Username or email<input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="Username or account email" autoComplete="username" maxLength={254} required/></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" minLength={6} required/></label>
        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy ? "Signing in…" : "Enter WinterArc"}<ChevronRight size={17}/></button>
      </form>
      <div className="auth-secure"><ShieldCheck size={15}/> No public registration. Access requires an authorized account.</div>
    </div></div>
  </div>;
}

function StatCard({ icon: Icon, label, value, detail, color = "green", progress, trend }) {
  return <div className="stat-card">
    <div className={`stat-icon ${color}`}><Icon size={21}/></div>
    <div className="stat-main"><div className="stat-label">{label}</div><div className="stat-value">{value}</div>
      {progress !== undefined && <div className="mini-progress"><span style={{ width: `${Math.min(100, progress)}%` }}/></div>}
      <div className="stat-detail">{trend && <span className="trend-pill"><ArrowUpRight size={13}/>{trend}</span>}{detail}</div>
    </div>
  </div>;
}

function DashboardView({ activeHabits, habits, monthStats, selectedMonth, setSelectedMonth, monthDays, selectedDay, setSelectedDay, isDone, countOnDate, toggleCompletion, weekData, dailyTrend, pieData, streak, openAddHabit, openEditHabit, loadingData, saveState, user, members }) {
  const todayHabits = activeHabits;
  const completedToday = countOnDate(today);
  const topHabit = [...monthStats.perHabit].sort((a,b) => b.rate - a.rate)[0];
  const weekTotal = weekData[weekData.length - 1];
  return <div className="page-content">
    <section className="stats-grid">
      <StatCard icon={Target} label="Monthly completion" value={`${monthStats.rate}%`} detail={`${monthStats.done} of ${monthStats.possible} check-ins`} progress={monthStats.rate}/>
      <StatCard icon={Trophy} label="Top habit" value={topHabit?.name || "—"} detail={`${topHabit?.rate || 0}% completion this month`} color="mint" progress={topHabit?.rate || 0}/>
      <StatCard icon={Flame} label="Current streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} detail={streak >= 7 ? "You're building momentum!" : "Keep showing up for yourself."} color="orange"/>
      <StatCard icon={ListChecks} label="Active habits" value={activeHabits.length} detail={`${habits.length - activeHabits.length} paused · ${habits.length} total`} color="blue"/>
    </section>

    <div className="dashboard-grid">
      <section className="panel tracker-panel">
        <div className="panel-header">
          <div className="panel-title-wrap"><div className="panel-icon"><CalendarDays size={18}/></div><div><h2>Daily habit tracker</h2><p>One check at a time.</p></div></div>
          <button className="text-button" onClick={openAddHabit}><Plus size={16}/> Add habit</button>
        </div>
        <div className="tracker-day-strip">
          {Array.from({ length: 7 }, (_, i) => addDays(subDays(today, 6), i)).map(day => <button key={day.toISOString()} onClick={() => setSelectedDay(day)} className={`day-chip ${isSameDay(day, selectedDay) ? "selected" : ""} ${isSameDay(day, today) ? "today" : ""}`}>
            <span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong><i className={countOnDate(day) ? "has-checks" : ""}/></button>)}
          <button className="day-chip all-days" onClick={() => setSelectedDay(today)}><span>Today</span><strong><ChevronRight size={18}/></strong></button>
        </div>
        <div className="selected-day-row"><div><strong>{isSameDay(selectedDay, today) ? "Today's habits" : format(selectedDay, "EEEE, MMM d")}</strong><span>{countOnDate(selectedDay)} of {activeHabits.length} completed</span></div><div className="tiny-progress"><span style={{ width: `${percent(countOnDate(selectedDay), activeHabits.length)}%` }}/></div></div>
        <div className="habit-list">
          {activeHabits.slice(0, 8).map((habit, i) => <HabitRow key={habit.id} habit={habit} done={isDone(habit.id, selectedDay)} onToggle={() => toggleCompletion(habit, selectedDay)} onEdit={() => openEditHabit(habit)} canEdit={!user || habit.user_id === user.id} ownerName={members.find(m => m.user_id === habit.user_id)?.display_name} rate={monthStats.perHabit.find(h => h.id === habit.id)?.rate ?? 0} />)}
          {!activeHabits.length && <EmptyState title="Start with one small habit" text="Add your first habit to begin tracking your progress." action={openAddHabit}/>}
        </div>
        {activeHabits.length > 8 && <button className="panel-footer-link" onClick={() => document.querySelector('[data-nav="My Habits"]')?.click()}>View all {activeHabits.length} habits <ChevronRight size={15}/></button>}
        {loadingData && <div className="loading-overlay">Syncing your habits…</div>}
      </section>

      <div className="right-column">
        <section className="panel chart-panel">
          <div className="panel-header compact"><div><h2>Weekly progress</h2><p>How your consistency is trending</p></div><span className="chart-badge"><TrendingUp size={15}/></span></div>
          <div className="chart-legend"><span className="legend-dot green-dot"/>Completion rate <span className="legend-muted">Last 4 weeks</span></div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={weekData} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="week" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={v => `${v}%`} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip formatter={v => [`${v}%`, "Completion"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)" }}/><Bar dataKey="rate" fill="#2b9565" radius={[6,6,0,0]} maxBarSize={34}/></BarChart></ResponsiveContainer></div>
          <div className="chart-bottom-note"><span className="trend-icon"><ArrowUpRight size={14}/></span><span><strong>{weekTotal?.rate ?? 0}%</strong> completion in the latest week</span></div>
        </section>

        <section className="panel chart-panel completion-panel">
          <div className="panel-header compact"><div><h2>Habit completion</h2><p>Monthly breakdown by habit</p></div><span className="chart-badge purple"><Activity size={15}/></span></div>
          <div className="donut-content">
            <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData.length ? pieData : [{ name: "No data", value: 1, color: "#e6eee8" }]} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="91%" paddingAngle={3} stroke="none">{(pieData.length ? pieData : [{ color: "#e6eee8" }]).map((item, i) => <Cell key={i} fill={item.color || PALETTE[i % PALETTE.length]}/>)}</Pie><Tooltip formatter={(v, n) => [`${v}%`, n]}/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{monthStats.rate}%</strong><span>overall</span></div></div>
            <div className="donut-legend">{[...monthStats.perHabit].sort((a,b) => b.rate-a.rate).slice(0,5).map((h,i) => <div key={h.id}><span className="legend-dot" style={{ background: h.color || PALETTE[i] }}/><span className="legend-name">{h.name}</span><strong>{h.rate}%</strong></div>)}</div>
          </div>
        </section>
      </div>
    </div>

    <div className="bottom-grid">
      <section className="panel top-habits-panel">
        <div className="panel-header compact"><div><h2><Trophy size={17} className="inline-title-icon"/> Top performing habits</h2><p>Give your wins some credit.</p></div><span className="subtle-tag">This month</span></div>
        <div className="rank-list">{[...monthStats.perHabit].sort((a,b) => b.rate-a.rate).slice(0,4).map((h,i) => <div className="rank-row" key={h.id}><span className={`rank-number rank-${i+1}`}>{i+1}</span><div className="rank-info"><div><strong>{h.emoji} {h.name}</strong><span>{h.rate}%</span></div><div className="rank-progress"><span style={{ width: `${h.rate}%`, background: h.color || PALETTE[i] }}/></div></div></div>)}</div>
      </section>
      <section className="panel mini-calendar-panel">
        <div className="panel-header compact"><div><h2><CalendarDays size={17} className="inline-title-icon"/> Monthly overview</h2><p>{format(selectedMonth, "MMMM yyyy")}</p></div><div className="calendar-nav"><button onClick={() => setSelectedMonth(subMonths(selectedMonth,1))} aria-label="Previous month"><ChevronLeft size={16}/></button><button onClick={() => setSelectedMonth(addMonths(selectedMonth,1))} aria-label="Next month"><ChevronRight size={16}/></button></div></div>
        <CalendarGrid selectedMonth={selectedMonth} selectedDay={selectedDay} setSelectedDay={setSelectedDay} activeHabits={todayHabits} countOnDate={countOnDate} isDone={isDone} compact/>
        <div className="calendar-legend"><span><i className="legend-dot green-dot"/> Completed</span><span><i className="legend-dot pale-dot"/> No check-ins</span></div>
      </section>
      <section className="panel trend-panel">
        <div className="panel-header compact"><div><h2><Activity size={17} className="inline-title-icon"/> Daily rhythm</h2><p>Your last 14 days at a glance.</p></div><span className="chart-badge"><Zap size={15}/></span></div>
        <div className="trend-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailyTrend} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#49a978" stopOpacity={0.28}/><stop offset="100%" stopColor="#49a978" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 9 }} interval={3} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={v => `${v}%`} tick={{ fill: "var(--muted)", fontSize: 9 }} axisLine={false} tickLine={false}/><Tooltip formatter={v => [`${v}%`, "Completed"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)" }}/><Area type="monotone" dataKey="rate" stroke="#278c5e" strokeWidth={2.5} fill="url(#trendFill)" activeDot={{ r: 4 }}/></AreaChart></ResponsiveContainer></div>
        <div className="motivation-note"><Sparkles size={16}/><span>Consistency beats intensity. Keep going.</span></div>
      </section>
    </div>
  </div>;
}

function HabitRow({ habit, done, onToggle, onEdit, rate, canEdit = true, ownerName }) {
  return <div className={`habit-row ${done ? "is-done" : ""}`}>
    <div className="habit-emoji" style={{ background: `${habit.color || "#2b9565"}20` }}>{habit.emoji || "✨"}</div>
    <div className="habit-row-info"><strong>{habit.name}</strong><span>{habit.target || habit.category || "Daily habit"} · {habit.cadence === "weekly" ? `Weekly · ${habit.weekly_target || 3}×` : habit.cadence === "ongoing" ? "Ongoing" : "Daily"}{ownerName ? ` · ${ownerName}` : ""}</span></div>
    <div className="habit-rate"><span>{rate}%</span><div className="habit-mini-bar"><span style={{ width: `${rate}%` }}/></div></div>
    <button className={`check-button ${done ? "checked" : ""}`} onClick={onToggle} aria-label={done ? `Mark ${habit.name} incomplete` : `Mark ${habit.name} complete`}>{done && <Check size={16}/>}</button>
    {canEdit && <button className="row-more" title="Edit habit" onClick={onEdit}><MoreHorizontal size={18}/></button>}
  </div>;
}

function CalendarGrid({ selectedMonth, selectedDay, setSelectedDay, activeHabits, countOnDate, isDone, compact = false }) {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  return <div className={`calendar-grid ${compact ? "compact-calendar" : ""}`}>
    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div className="calendar-weekday" key={d}>{compact ? d.slice(0,1) : d}</div>)}
    {days.map(day => {
      const count = countOnDate(day);
      const rate = percent(count, activeHabits.length);
      const future = day > today;
      const currentMonth = isSameMonth(day, selectedMonth);
      return <button key={day.toISOString()} disabled={future} onClick={() => setSelectedDay(day)} className={`calendar-cell ${!currentMonth ? "outside" : ""} ${isSameDay(day, selectedDay) ? "selected" : ""} ${isSameDay(day, today) ? "is-today" : ""} ${count > 0 && !future ? "has-progress" : ""}`} title={`${format(day,"MMM d")}: ${count}/${activeHabits.length} habits`} style={{ "--day-progress": `${rate}%` }}>
        <span>{format(day,"d")}</span>{!future && currentMonth && count > 0 && <i style={{ opacity: 0.35 + rate / 150 }}/>}
      </button>;
    })}
  </div>;
}

function HabitsView({ habits, currentUserId, members, isDone, selectedDay, setSelectedDay, toggleCompletion, openAddHabit, openEditHabit, deleteHabit, toggleHabitActive }) {
  const active = habits.filter(h => h.active !== false);
  const paused = habits.filter(h => h.active === false);
  return <div className="page-content">
    <div className="section-intro"><div><h2>Your habit library</h2><p>Keep the routines that matter. Adjust them as life changes.</p></div><button className="primary-button" onClick={openAddHabit}><Plus size={17}/> New habit</button></div>
    <div className="habit-summary-strip"><div><strong>{active.length}</strong><span>Active habits</span></div><div><strong>{paused.length}</strong><span>Paused</span></div><div><strong>{active.filter(h => isDone(h.id, selectedDay)).length}</strong><span>Done today</span></div><div className="summary-date"><CalendarDays size={17}/><input type="date" value={localDateKey(selectedDay)} onChange={e => e.target.value && setSelectedDay(new Date(`${e.target.value}T12:00:00`))}/></div></div>
    <div className="habit-cards-grid">{active.map((h,i) => <HabitCard key={h.id} habit={h} index={i} done={isDone(h.id, selectedDay)} weeklyDone={eachDayOfInterval({start:startOfWeek(today),end:today}).filter(day=>isDone(h.id,day)).length} ownerName={members?.find(m=>m.user_id===h.user_id)?.display_name} canManage={!currentUserId || h.user_id===currentUserId} onToggle={() => toggleCompletion(h, selectedDay)} onEdit={() => openEditHabit(h)} onDelete={() => deleteHabit(h)} onPause={() => toggleHabitActive(h)}/>)}</div>
    {paused.length > 0 && <><div className="subsection-heading"><h3>Paused habits</h3><span>{paused.length}</span></div><div className="habit-cards-grid">{paused.map((h,i) => <HabitCard key={h.id} habit={h} index={i} done={false} ownerName={members?.find(m=>m.user_id===h.user_id)?.display_name} canManage={!currentUserId || h.user_id===currentUserId} onToggle={() => {}} onEdit={() => openEditHabit(h)} onDelete={() => deleteHabit(h)} onPause={() => toggleHabitActive(h)} paused/>)}</div></>}
  </div>;
}

function HabitCard({ habit, index, done, onToggle, onEdit, onDelete, onPause, paused, canManage = true, ownerName, weeklyDone = 0 }) {
  return <div className={`habit-card ${paused ? "paused" : ""}`}>
    <div className="habit-card-top"><div className="habit-card-emoji" style={{ background: `${habit.color || PALETTE[index % PALETTE.length]}20` }}>{habit.emoji || "✨"}</div>{canManage && <button className="icon-button" onClick={onEdit} title="Edit"><Pencil size={16}/></button>}</div>
    <div className="habit-card-title"><h3>{habit.name}</h3><span className="category-pill">{habit.category || "Personal"}</span></div>
    <p>{habit.target || "A small step, repeated consistently."}</p><div className="habit-meta-pills"><span>{habit.cadence === "weekly" ? `This week · ${weeklyDone}/${habit.weekly_target || 3} days` : habit.cadence === "ongoing" ? "Ongoing · no end date" : "Daily"}</span>{ownerName && <span>By {ownerName}</span>}</div>
    <div className="habit-card-bottom"><button className={`check-button large ${done ? "checked" : ""}`} disabled={paused} onClick={onToggle}>{done && <Check size={16}/>}</button><span>{paused ? "Paused" : done ? "Completed" : "Not completed"}</span>{canManage && <div className="habit-card-actions"><button title={paused ? "Resume" : "Pause"} onClick={onPause}>{paused ? <Activity size={16}/> : <Moon size={16}/>}</button><button title="Delete" onClick={onDelete}><Trash2 size={16}/></button></div>}</div>
  </div>;
}

function CalendarView({ selectedMonth, setSelectedMonth, monthDays, selectedDay, setSelectedDay, activeHabits, countOnDate, isDone, toggleCompletion }) {
  const selectedDone = activeHabits.filter(h => isDone(h.id, selectedDay));
  return <div className="page-content">
    <div className="section-intro"><div><h2>Your consistency calendar</h2><p>Choose a date to see and update your daily habits.</p></div><div className="calendar-month-controls"><button className="icon-button" onClick={() => setSelectedMonth(subMonths(selectedMonth,1))}><ChevronLeft size={18}/></button><strong>{format(selectedMonth,"MMMM yyyy")}</strong><button className="icon-button" onClick={() => setSelectedMonth(addMonths(selectedMonth,1))}><ChevronRight size={18}/></button></div></div>
    <div className="calendar-layout"><section className="panel large-calendar-panel"><div className="calendar-topline"><span><i className="legend-dot green-dot"/> Habit activity</span><span>{format(selectedMonth,"MMMM yyyy")}</span></div><CalendarGrid selectedMonth={selectedMonth} selectedDay={selectedDay} setSelectedDay={setSelectedDay} activeHabits={activeHabits} countOnDate={countOnDate} isDone={isDone}/><div className="calendar-legend"><span><i className="legend-dot green-dot"/> At least one completed</span><span><i className="legend-dot pale-dot"/> No completions</span></div></section>
      <section className="panel selected-date-panel"><div className="selected-date-heading"><div className="panel-icon"><CalendarDays size={18}/></div><div><h2>{format(selectedDay,"EEEE")}</h2><p>{format(selectedDay,"MMMM d, yyyy")}</p></div></div><div className="selected-date-score"><strong>{percent(selectedDone.length, activeHabits.length)}%</strong><span>{selectedDone.length} of {activeHabits.length} habits complete</span><div className="mini-progress"><span style={{ width: `${percent(selectedDone.length,activeHabits.length)}%` }}/></div></div><div className="date-habit-list">{activeHabits.map(h => <button key={h.id} onClick={() => toggleCompletion(h,selectedDay)} className={`date-habit ${isDone(h.id,selectedDay) ? "done" : ""}`}><span className="date-habit-emoji">{h.emoji}</span><span>{h.name}</span><i>{isDone(h.id,selectedDay) && <Check size={14}/>}</i></button>)}</div></section></div>
  </div>;
}

function StatisticsView({ monthStats, weekData, dailyTrend, pieData, activeHabits, selectedMonth }) {
  return <div className="page-content">
    <div className="section-intro"><div><h2>Your progress, in perspective</h2><p>Insights for {format(selectedMonth,"MMMM yyyy")} — small improvements add up.</p></div><span className="subtle-tag"><Activity size={14}/> Live statistics</span></div>
    <div className="stats-grid stats-grid-three"><StatCard icon={Target} label="Completion rate" value={`${monthStats.rate}%`} detail="Across all check-ins" progress={monthStats.rate}/><StatCard icon={CheckCheck} label="Habits completed" value={monthStats.done} detail={`Out of ${monthStats.possible} possible`} color="mint"/><StatCard icon={Zap} label="Active routines" value={activeHabits.length} detail="Habits in your current routine" color="orange"/></div>
    <div className="statistics-grid"><section className="panel stats-wide"><div className="panel-header compact"><div><h2>Daily completion trend</h2><p>Last two weeks</p></div></div><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailyTrend}><defs><linearGradient id="statFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38a16d" stopOpacity={0.25}/><stop offset="100%" stopColor="#38a16d" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="day" tick={{ fill:"var(--muted)", fontSize:11 }} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fill:"var(--muted)",fontSize:11}} axisLine={false} tickLine={false}/><Tooltip formatter={v=>[`${v}%`,"Completion"]}/><Area type="monotone" dataKey="rate" stroke="#25865a" fill="url(#statFill)" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></section>
      <section className="panel"><div className="panel-header compact"><div><h2>Weekly comparison</h2><p>Four-week view</p></div></div><div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={weekData} margin={{top:10,right:6,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="week" tick={{fill:"var(--muted)",fontSize:10}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fill:"var(--muted)",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip formatter={v=>[`${v}%`,"Completion"]}/><Bar dataKey="rate" fill="#43a875" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></section>
      <section className="panel stats-wide"><div className="panel-header compact"><div><h2>Habit-by-habit performance</h2><p>What’s working well for you?</p></div></div><div className="performance-table"><div className="performance-head"><span>Habit</span><span>Completion</span><span>Rate</span></div>{[...monthStats.perHabit].sort((a,b)=>b.rate-a.rate).map((h,i)=><div className="performance-row" key={h.id}><span className="performance-name"><i style={{background:h.color||PALETTE[i%PALETTE.length]}}/>{h.emoji} {h.name}</span><div className="rank-progress"><span style={{width:`${h.rate}%`,background:h.color||PALETTE[i%PALETTE.length]}}/></div><strong>{h.rate}%</strong></div>)}</div></section>
      <section className="panel"><div className="panel-header compact"><div><h2>Consistency mix</h2><p>Completion by habit</p></div></div><div className="statistics-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData.length?pieData:[{name:"No data",value:1}]} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" paddingAngle={3} stroke="none">{(pieData.length?pieData:[{}]).map((h,i)=><Cell key={i} fill={h.color||PALETTE[i%PALETTE.length]}/>)}</Pie><Tooltip formatter={(v,n)=>[`${v}%`,n]}/></PieChart></ResponsiveContainer></div></section>
    </div>
  </div>;
}

function SettingsView({ user, darkMode, setDarkMode, signOut, demoMode }) {
  return <div className="page-content settings-page"><div className="section-intro"><div><h2>Settings & preferences</h2><p>A few simple controls to make this space your own.</p></div></div>
    <section className="panel settings-panel"><div className="settings-section-title"><div className="settings-icon"><UserRound size={19}/></div><div><h3>Account</h3><p>Your personal WinterArc Challenge account</p></div></div><div className="settings-row"><div><strong>Email address</strong><span>{user?.email || "Preview mode — no account connected"}</span></div>{user && <span className="verified-pill"><ShieldCheck size={13}/> Signed in</span>}</div><div className="settings-row"><div><strong>Data sync</strong><span>{demoMode ? "Preview only. Configure Supabase to sync across devices." : "Your habits and completions are saved to your cloud database."}</span></div><span className={`connection-pill ${demoMode?"offline":"online"}`}><span/>{demoMode?"Not connected":"Connected"}</span></div>{user && <div className="settings-row"><div><strong>Sign out</strong><span>Sign out of this device.</span></div><button className="secondary-button" onClick={signOut}><LogOut size={15}/> Sign out</button></div>}</section>
    <section className="panel settings-panel"><div className="settings-section-title"><div className="settings-icon"><Sun size={19}/></div><div><h3>Appearance</h3><p>Choose the look that feels comfortable.</p></div></div><div className="settings-row"><div><strong>Dark mode</strong><span>Use a darker theme for low-light environments.</span></div><button className={`switch ${darkMode?"on":""}`} onClick={()=>setDarkMode(v=>!v)} aria-label="Toggle dark mode"><i/></button></div></section>
    <section className="panel settings-panel"><div className="settings-section-title"><div className="settings-icon"><ShieldCheck size={19}/></div><div><h3>Privacy & data</h3><p>Your habits belong to you.</p></div></div><p className="privacy-copy">Only the two UUIDs listed in challenge_members can access shared challenge data. Both participants can check off either person’s tasks; only the habit owner can edit or delete a habit. Keep public sign-ups disabled and never put a Supabase service-role key in frontend code.</p></section>
    <section className="panel setup-instructions"><div className="setup-icon"><Cloud size={21}/></div><div><h3>Connect your cloud database</h3><p>Follow the README included with this project to configure Supabase, apply the database schema, and enable account sign-in and cross-device syncing.</p></div></section>
  </div>;
}

function HabitModal({ form, setForm, onSave, onClose, error, editing }) {
  const emojis = ["✨","🌤️","💪","📚","💻","🎙️","📖","💧","🗓️","🧘","🏃","🎯","🌱","📝"];
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><form className="habit-modal" onSubmit={onSave}>
    <div className="modal-header"><div><span className="eyebrow">{editing ? "REFINE YOUR ROUTINE" : "MAKE A LITTLE PROMISE"}</span><h2>{editing ? "Edit habit" : "Add a new habit"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={19}/></button></div>
    <label>Habit name<input autoFocus maxLength={80} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} placeholder="e.g. Read for 15 minutes" required/></label>
    <label>Why does it matter? <span className="optional-label">Optional</span><input maxLength={120} value={form.target} onChange={e=>setForm(v=>({...v,target:e.target.value}))} placeholder="e.g. Learn something new every day"/></label>
    <label>Category<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{["Personal","Health","Learning","Career","Mindfulness","Productivity","Relationships","Finance"].map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Habit schedule<select value={form.cadence || "daily"} onChange={e=>setForm(v=>({...v,cadence:e.target.value}))}><option value="daily">Daily — every day</option><option value="weekly">Weekly — choose days per week</option><option value="ongoing">Ongoing — no end date</option></select></label>
    {form.cadence === "weekly" && <label>Weekly target<select value={form.weekly_target || 3} onChange={e=>setForm(v=>({...v,weekly_target:Number(e.target.value)}))}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} {n===1?"day":"days"} per week</option>)}</select></label>}
    <div className="emoji-field"><span className="field-label">Choose an icon</span><div className="emoji-options">{emojis.map(e=><button type="button" key={e} className={form.emoji===e?"selected":""} onClick={()=>setForm(v=>({...v,emoji:e}))}>{e}</button>)}</div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={16}/>{editing?"Save changes":"Create habit"}</button></div>
  </form></div>;
}

function EmptyState({ title, text, action }) {
  return <div className="empty-state"><div className="empty-icon"><Leaf size={24}/></div><h3>{title}</h3><p>{text}</p><button className="primary-button" onClick={action}><Plus size={16}/> Add a habit</button></div>;
}
export default App;