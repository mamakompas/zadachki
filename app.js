/* Задачки — семейно приложение за задачи, напомняния и седмична заплата */
(() => {
  'use strict';

  // =====================================================================
  //  Помощни функции
  // =====================================================================
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const isoDow = (s) => ((parseYmd(s).getDay() + 6) % 7) + 1;
  const today = () => ymd(new Date());
  const nowHM = () => { const d = new Date(); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const weekStart = (s) => addDays(s, -(isoDow(s) - 1));
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const DOW_LONG = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя'];
  const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
  const fmtDay = (s) => { const d = parseYmd(s); return `${DOW_LONG[isoDow(s) - 1]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const fmtShort = (s) => { const d = parseYmd(s); return `${DOW[isoDow(s) - 1]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.`; };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TILE_COLORS = ['#ffe58a', '#c9e7ff', '#ffd1e3', '#d9ccff', '#ffd0b5', '#bdf0ff', '#fff0c2', '#ffd6c2', '#c8f5dc', '#ffe0a8', '#fff3a3', '#cfe0ff', '#e6d6ff', '#ffcfee'];
  const KID_GRADS = [['#ff5fa2', '#ff8a5b'], ['#3aa0ff', '#7c5cff'], ['#19b867', '#0fb5c9'], ['#ff8a3d', '#ffb800'], ['#7c4dff', '#ff5fa2'], ['#ff4757', '#ff8a3d'], ['#0fb5c9', '#3aa0ff'], ['#2a1f3d', '#5b3f8c']];
  const AVATARS = ['🦋', '🦄', '🐱', '🐶', '🦊', '🐼', '🐰', '🐸', '🦁', '🐯', '🐨', '🐙', '🌸', '🌈', '⭐', '🍓', '🎀', '🎧', '⚽', '🎨', '🎮', '👑', '💎', '🌙'];
  const TASK_EMOJIS = ['✅', '☀️', '🌙', '🛏️', '🧸', '📚', '🛁', '🚿', '🦷', '🥣', '🍽️', '🌀', '🏠', '🧽', '👕', '🪶', '👗', '🗑️', '🐕', '🪴', '🧹', '🧺', '🎒', '🎹', '📖', '🏃', '🛒', '🍳'];
  const grad = (k) => `linear-gradient(135deg, ${k.color}, ${k.color2})`;

  // =====================================================================
  //  Хранилище: Supabase (истинско) или демо (в браузъра)
  // =====================================================================
  function supabaseStore(url, key) {
    const sb = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fam-auth' } });
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    let user = null;
    return {
      kind: 'supabase',
      async session() { const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : null; return user; },
      async signIn(email, password) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) throw r.error; user = r.data.user; return user; },
      async signUp(email, password, meta) {
        const r = await sb.auth.signUp({ email, password, options: { data: meta } });
        if (r.error) throw r.error;
        user = r.data.session ? r.data.user : null;
        return { needsConfirm: !r.data.session };
      },
      async signOut() { await sb.auth.signOut(); user = null; },
      async publicProfiles() { return ok(await sb.rpc('fam_public_profiles')); },
      async me() { return ok(await sb.from('fam_members').select('*').eq('user_id', user.id).maybeSingle()); },
      async base() {
        const [settings, kids, members, templates] = await Promise.all([
          sb.from('fam_settings').select('*').eq('id', 1).single().then(ok),
          sb.from('fam_kids').select('*').order('sort').order('created_at').then(ok),
          sb.from('fam_members').select('*').then(ok),
          sb.from('fam_templates').select('*').order('sort').order('created_at').then(ok),
        ]);
        return { settings, kids, members, templates };
      },
      async ensureDay(day) { ok(await sb.rpc('fam_ensure_day', { p_day: day })); },
      async tasks({ from, to, kidId }) {
        let q = sb.from('fam_tasks').select('*').gte('day', from).lte('day', to).order('day').order('created_at');
        if (kidId) q = q.eq('kid_id', kidId);
        return ok(await q);
      },
      async weekTotals(kidId) { let q = sb.from('fam_week_totals').select('*'); if (kidId) q = q.eq('kid_id', kidId); return ok(await q); },
      async ledger(kidId) { let q = sb.from('fam_ledger').select('*').order('created_at', { ascending: false }); if (kidId) q = q.eq('kid_id', kidId); return ok(await q); },
      async setMyTask(id, done) { return ok(await sb.rpc('fam_set_my_task', { p_task: id, p_done: done })); },
      async updateTask(id, patch) { ok(await sb.from('fam_tasks').update(patch).eq('id', id)); },
      async addTasks(rows) { ok(await sb.from('fam_tasks').upsert(rows, { onConflict: 'kid_id,day,template_id', ignoreDuplicates: true })); },
      async deleteTask(id) { ok(await sb.from('fam_tasks').delete().eq('id', id)); },
      async saveTemplate(t) { return ok(await sb.from('fam_templates').upsert(t).select().single()); },
      async deleteTemplate(id) { ok(await sb.from('fam_templates').delete().eq('id', id)); },
      async addLedger(rows) { ok(await sb.from('fam_ledger').insert(rows)); },
      async deleteLedger(id) { ok(await sb.from('fam_ledger').delete().eq('id', id)); },
      async saveSettings(patch) { ok(await sb.from('fam_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)); },
      async saveKid(k) { ok(await sb.from('fam_kids').update({ name: k.name, avatar: k.avatar, color: k.color, color2: k.color2 }).eq('id', k.id)); },
      async updateMyLook(avatar, color, color2) { ok(await sb.rpc('fam_update_my_look', { p_avatar: avatar, p_color: color, p_color2: color2 })); },
      async updateMyName(name) { ok(await sb.from('fam_members').update({ display_name: name }).eq('user_id', user.id)); },
      async savePushSub(s) { ok(await sb.from('fam_push_subs').upsert({ user_id: user.id, ...s }, { onConflict: 'endpoint' })); },
      async deletePushSub(endpoint) { ok(await sb.from('fam_push_subs').delete().eq('endpoint', endpoint)); },
    };
  }

  // Демо: същата логика като базата, но в браузъра. Измислени имена и имейли.
  function demoStore() {
    const KEY = 'fam-demo-db';
    const T = (title, emoji, color, reward, repeat, due_time, day_times) =>
      ({ id: uid(), title, emoji, color, reward, penalty: null, due_time: due_time || null, day_times: day_times || {}, repeat_days: repeat ? [1, 2, 3, 4, 5, 6, 7] : [], kid_ids: [], active: true, sort: 0 });
    function seed() {
      const k1 = { id: uid(), name: 'Ани', avatar: '🦋', color: '#ff5fa2', color2: '#ff8a5b', sort: 1 };
      const k2 = { id: uid(), name: 'Вики', avatar: '🦄', color: '#3aa0ff', color2: '#7c5cff', sort: 2 };
      const templates = [
        T('Сутрешна рутина', '☀️', '#ffe58a', 0, true), T('Оправяне на легло', '🛏️', '#c9e7ff', 0, true),
        T('Подреждане на стая', '🧸', '#ffd1e3', 0, true), T('Вечерна рутина', '🌙', '#d9ccff', 0, true, '21:00', { 5: '22:00', 6: '22:00' }),
        T('Домашни', '📚', '#ffd0b5', 0), T('Къпане', '🛁', '#bdf0ff', 0), T('Съдомиялна сутрин', '🥣', '#fff0c2', 1),
        T('Съдомиялна вечер', '🍽️', '#ffd6c2', 1), T('Прахосмукачка собствена стая', '🌀', '#c8f5dc', 1),
        T('Прахосмукачка цяла къща', '🏠', '#ffe0a8', 2), T('Моп цяла къща', '🧽', '#fff3a3', 1),
        T('Сгъване пране', '👕', '#cfe0ff', 1), T('Бърсане на прах', '🪶', '#e6d6ff', 1), T('Подреждане на гардероб', '👗', '#ffcfee', 1),
      ].map((t, i) => ({ ...t, sort: (i + 1) * 10 }));
      const users = [
        { user_id: 'demo-parent', email: 'roditel@demo.bg', role: 'parent', kid_id: null, display_name: 'Мама' },
        { user_id: 'demo-k1', email: 'ani@demo.bg', role: 'kid', kid_id: k1.id, display_name: null },
        { user_id: 'demo-k2', email: 'viki@demo.bg', role: 'kid', kid_id: k2.id, display_name: null },
      ];
      const db = {
        settings: { id: 1, currency: '€', timezone: 'Europe/Sofia', kid_reminder_times: ['16:00', '19:00'], parent_reminder_time: '21:00', before_minutes: 15, unpaid_penalty: 0.5, vapid_public: null },
        kids: [k1, k2], members: users, templates, tasks: [], ledger: [], session: null,
      };
      // история от последните дни, за да има какво да се види
      const td = today();
      for (let i = 9; i >= 1; i--) {
        const day = addDays(td, -i);
        genDay(db, day);
        const extra = [['Съдомиялна вечер', k1], ['Прахосмукачка собствена стая', k2], ['Сгъване пране', i % 2 ? k1 : k2]];
        extra.forEach(([title, k]) => { const t = templates.find((x) => x.title === title); db.tasks.push(taskFrom(db, t, k.id, day)); });
        db.tasks.filter((t) => t.day === day).forEach((t, j) => { if ((i + j) % 5 !== 0) { t.status = 'done'; t.done_at = new Date().toISOString(); } });
      }
      genDay(db, td);
      const add = (title, k, time) => { const t = templates.find((x) => x.title === title); db.tasks.push({ ...taskFrom(db, t, k.id, td), due_time: time || null }); };
      add('Съдомиялна сутрин', k1); add('Прахосмукачка цяла къща', k1, '18:00'); add('Домашни', k2, '17:00'); add('Съдомиялна вечер', k2, '20:00');
      db.tasks.filter((t) => t.day === td && /Сутрешна|легло|сутрин/.test(t.title)).forEach((t) => { t.status = 'done'; t.done_at = new Date().toISOString(); });
      return db;
    }
    function penaltyOf(db, t) { return t.penalty != null ? Number(t.penalty) : (Number(t.reward) > 0 ? Number(t.reward) : Number(db.settings.unpaid_penalty)); }
    function taskFrom(db, t, kidId, day) {
      return { id: uid(), kid_id: kidId, day, template_id: t.id, title: t.title, emoji: t.emoji, color: t.color, reward: Number(t.reward), penalty: penaltyOf(db, t),
        due_time: (t.day_times && t.day_times[isoDow(day)]) || t.due_time || null, status: 'pending', done_at: null, created_at: new Date().toISOString() };
    }
    function genDay(db, day) {
      for (const t of db.templates) {
        if (!t.active || !t.repeat_days.includes(isoDow(day))) continue;
        for (const k of db.kids) {
          if (t.kid_ids.length && !t.kid_ids.includes(k.id)) continue;
          if (db.tasks.some((x) => x.kid_id === k.id && x.day === day && x.template_id === t.id)) continue;
          db.tasks.push(taskFrom(db, t, k.id, day));
        }
      }
    }
    let db; try { db = JSON.parse(lsGet(KEY)); } catch (_) { db = null; }
    if (!db || !db.kids) db = seed();
    const save = () => lsSet(KEY, JSON.stringify(db));
    save();
    const me = () => db.members.find((m) => m.user_id === db.session);
    const isParent = () => (me() || {}).role === 'parent';
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const delay = (v) => new Promise((r) => setTimeout(() => r(clone(v)), 60));
    const deny = () => { throw new Error('Нямаш права за това'); };
    return {
      kind: 'demo',
      demoUsers: () => db.members.map((m) => ({ ...m, kid: db.kids.find((k) => k.id === m.kid_id) })),
      resetDemo() { lsSet(KEY, null); db = seed(); save(); },
      async session() { return db.session ? { id: db.session } : null; },
      async signIn(email) { const m = db.members.find((x) => x.email === String(email).toLowerCase()); if (!m) throw new Error('Invalid login credentials'); db.session = m.user_id; save(); return { id: m.user_id }; },
      async signUp() { throw new Error('В демото регистрацията е изключена. Влез с някой от готовите профили.'); },
      async signOut() { db.session = null; save(); },
      async publicProfiles() { return delay(db.kids); },
      async me() { return delay(me() || null); },
      async base() { return delay({ settings: db.settings, kids: db.kids, members: db.members, templates: db.templates }); },
      async ensureDay(day) { genDay(db, day); save(); },
      async tasks({ from, to, kidId }) {
        const m = me();
        return delay(db.tasks.filter((t) => t.day >= from && t.day <= to && (!kidId || t.kid_id === kidId) && (m.role === 'parent' || t.kid_id === m.kid_id))
          .sort((a, b) => a.day.localeCompare(b.day) || a.created_at.localeCompare(b.created_at)));
      },
      async weekTotals(kidId) {
        const m = me(); const td = today(); const map = {};
        for (const t of db.tasks) {
          if (kidId && t.kid_id !== kidId) continue;
          if (m.role !== 'parent' && t.kid_id !== m.kid_id) continue;
          const k = t.kid_id + '|' + weekStart(t.day);
          const w = map[k] || (map[k] = { kid_id: t.kid_id, week_start: weekStart(t.day), earned: 0, lost: 0, done_count: 0, missed_count: 0 });
          if (t.status === 'done') { w.earned += t.reward; w.done_count++; }
          if (t.status === 'pending' && t.day < td) { w.lost += t.penalty; w.missed_count++; }
        }
        return delay(Object.values(map));
      },
      async ledger(kidId) { const m = me(); return delay(db.ledger.filter((l) => (!kidId || l.kid_id === kidId) && (m.role === 'parent' || l.kid_id === m.kid_id)).sort((a, b) => b.created_at.localeCompare(a.created_at))); },
      async setMyTask(id, done) {
        const t = db.tasks.find((x) => x.id === id);
        if (!t || t.kid_id !== me().kid_id || t.day !== today() || t.status === 'skipped') throw new Error('Задачата не може да се промени');
        Object.assign(t, { status: done ? 'done' : 'pending', done_at: done ? new Date().toISOString() : null }); save(); return delay(t);
      },
      async updateTask(id, patch) { if (!isParent()) deny(); Object.assign(db.tasks.find((x) => x.id === id), patch); save(); },
      async addTasks(rows) {
        if (!isParent()) deny();
        for (const r of rows) {
          if (r.template_id && db.tasks.some((x) => x.kid_id === r.kid_id && x.day === r.day && x.template_id === r.template_id)) continue;
          db.tasks.push({ id: uid(), status: 'pending', done_at: null, created_at: new Date().toISOString(), ...r });
        }
        save();
      },
      async deleteTask(id) { if (!isParent()) deny(); db.tasks = db.tasks.filter((x) => x.id !== id); save(); },
      async saveTemplate(t) {
        if (!isParent()) deny();
        const row = { id: t.id || uid(), ...t }; const i = db.templates.findIndex((x) => x.id === row.id);
        if (i >= 0) db.templates[i] = { ...db.templates[i], ...row }; else db.templates.push(row);
        save(); return delay(row);
      },
      async deleteTemplate(id) { if (!isParent()) deny(); db.templates = db.templates.filter((x) => x.id !== id); db.tasks.forEach((t) => { if (t.template_id === id) t.template_id = null; }); save(); },
      async addLedger(rows) { if (!isParent()) deny(); rows.forEach((r) => db.ledger.push({ id: uid(), created_at: new Date().toISOString(), note: null, ...r })); save(); },
      async deleteLedger(id) { if (!isParent()) deny(); db.ledger = db.ledger.filter((x) => x.id !== id); save(); },
      async saveSettings(patch) { if (!isParent()) deny(); Object.assign(db.settings, patch); save(); },
      async saveKid(k) { if (!isParent()) deny(); Object.assign(db.kids.find((x) => x.id === k.id), { name: k.name, avatar: k.avatar, color: k.color, color2: k.color2 }); save(); },
      async updateMyLook(avatar, color, color2) { Object.assign(db.kids.find((x) => x.id === me().kid_id), { avatar, color, color2 }); save(); },
      async updateMyName(name) { me().display_name = name; save(); },
      async savePushSub() {}, async deletePushSub() {},
    };
  }

  // =====================================================================
  //  Състояние
  // =====================================================================
  const S = {
    store: null, me: null, settings: null, kids: [], members: [], templates: [],
    screen: 'boot', tab: null, day: today(),
    tasks: [], weekTasks: [], hist: [], totals: [], ledger: [],
    reg: { role: 'parent' }, profiles: [], busy: false, error: null,
  };
  const kidById = (id) => S.kids.find((k) => k.id === id);
  const myKid = () => (S.me && S.me.kid_id ? kidById(S.me.kid_id) : null);
  const isParent = () => S.me && S.me.role === 'parent';
  const cur = () => (S.settings && S.settings.currency) || '€';
  const eur = (n) => { const v = r2(n); return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ',') + ' ' + cur(); };

  // ---------- статус на задача ----------
  function stateOf(t) {
    if (t.status === 'done') return 'done';
    if (t.status === 'skipped') return 'skip';
    const td = today();
    if (t.day < td) return 'missed';
    if (t.day === td && t.due_time && nowHM() >= t.due_time) return 'late';
    return 'todo';
  }
  const RANK = { missed: 0, late: 0, todo: 1, done: 2, skip: 3 };
  const sortTasks = (list) => list.slice().sort((a, b) => RANK[stateOf(a)] - RANK[stateOf(b)] || (a.due_time || '99').localeCompare(b.due_time || '99') || a.title.localeCompare(b.title, 'bg'));

  // ---------- портфейл ----------
  // Всяка седмица (Пн–Нд): спечелено + бонуси − удръжки, но не под 0; минус изплатеното.
  function wallet(kidId) {
    const weeks = {};
    const W = (ws) => weeks[ws] || (weeks[ws] = { earned: 0, lost: 0, bonus: 0, deduction: 0, paid: 0 });
    S.totals.filter((t) => t.kid_id === kidId).forEach((t) => { const w = W(t.week_start); w.earned += Number(t.earned); w.lost += Number(t.lost); });
    S.ledger.filter((l) => l.kid_id === kidId).forEach((l) => { W(l.week_start)[l.kind === 'payout' ? 'paid' : l.kind] += Number(l.amount); });
    let balance = 0;
    const out = {};
    for (const [ws, w] of Object.entries(weeks)) {
      const net = Math.max(0, r2(w.earned + w.bonus - w.lost - w.deduction));
      const remaining = Math.max(0, r2(net - w.paid));
      out[ws] = { ...w, net, remaining };
      balance += remaining;
    }
    const thisWeek = out[weekStart(today())] || { earned: 0, lost: 0, bonus: 0, deduction: 0, paid: 0, net: 0, remaining: 0 };
    const atRisk = S.tasks.concat(S.weekTasks).filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i)
      .filter((t) => t.kid_id === kidId && t.day === today() && t.status === 'pending').reduce((s, t) => s + Number(t.penalty), 0);
    return { balance: r2(balance), weeks: out, thisWeek, atRisk: r2(atRisk) };
  }

  // =====================================================================
  //  Зареждане на данни
  // =====================================================================
  async function loadBase() {
    const b = await S.store.base();
    Object.assign(S, b);
  }
  async function loadKid() {
    const k = myKid(); const td = today();
    await S.store.ensureDay(td);
    const [tasks, hist, totals, ledger] = await Promise.all([
      S.store.tasks({ from: td, to: td, kidId: k.id }),
      S.store.tasks({ from: addDays(td, -30), to: td, kidId: k.id }),
      S.store.weekTotals(k.id), S.store.ledger(k.id),
    ]);
    Object.assign(S, { tasks, hist, weekTasks: hist.filter((t) => t.day >= addDays(td, -6)), totals, ledger });
  }
  async function loadParent() {
    const td = today();
    if (S.day >= td) await S.store.ensureDay(S.day);
    if (S.day !== td) await S.store.ensureDay(td);
    const [tasks, hist, totals, ledger] = await Promise.all([
      S.store.tasks({ from: S.day, to: S.day }),
      S.store.tasks({ from: addDays(td, -30), to: td }),
      S.store.weekTotals(), S.store.ledger(),
    ]);
    Object.assign(S, { tasks, hist, weekTasks: hist.filter((t) => t.day >= addDays(td, -6)), totals, ledger });
  }
  async function refresh(quiet) {
    if (!S.me) return;
    try {
      if (!quiet) S.busy = true;
      await loadBase();
      if (isParent()) await loadParent(); else await loadKid();
      S.error = null;
    } catch (e) { S.error = friendly(e); }
    S.busy = false;
    if (!$('.sheet-bg')) render();
  }

  function friendly(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/Database error saving new user|FAM_NOT_ALLOWED|FAM_WRONG_ROLE/i.test(m)) return 'Този имейл не е одобрен за избрания профил. Провери имейла и дали си избрал правилния профил.';
    if (/Invalid login credentials/i.test(m)) return 'Грешен имейл или парола.';
    if (/missing email/i.test(m)) return 'Попълни имейла.';
    if (/Email not confirmed/i.test(m)) return 'Имейлът още не е потвърден. Отвори писмото от Supabase и натисни линка.';
    if (/already registered|already been registered/i.test(m)) return 'Този имейл вече има профил. Влез с него.';
    if (/Password should be at least/i.test(m)) return 'Паролата трябва да е поне 6 символа.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Няма връзка с интернет. Опитай пак.';
    return m;
  }

  // =====================================================================
  //  Ефекти и общи елементи
  // =====================================================================
  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; el.setAttribute('role', 'status');
    $('#toast-root').appendChild(el); setTimeout(() => el.remove(), 2600);
  }
  function coinPop(x, y, text) {
    const el = document.createElement('div'); el.className = 'coinpop'; el.textContent = text;
    el.style.left = Math.max(10, x - 50) + 'px'; el.style.top = (y - 30) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
  }
  function confetti(n) {
    if (prefersReducedMotion()) return;
    const wrap = document.createElement('div'); wrap.className = 'confetti';
    const colors = ['#ff4757', '#ffb800', '#19b867', '#2d8cff', '#7c4dff', '#ff5fa2'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%'; c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.4 + Math.random() * 1.4) + 's'; c.style.animationDelay = (Math.random() * 0.4) + 's';
      wrap.appendChild(c);
    }
    document.body.appendChild(wrap); setTimeout(() => wrap.remove(), 3300);
  }
  function sheet(html) {
    $('#modal-root').innerHTML = `<div class="sheet-bg" data-close-bg><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  }
  function closeSheet() { $('#modal-root').innerHTML = ''; render(); }
  const tile = (e, c) => `<span class="em" style="background:${esc(c)}" aria-hidden="true">${esc(e)}</span>`;

  function taskHTML(t, compact) {
    const st = stateOf(t); const meta = [];
    if (st === 'missed') meta.push(`<span class="pill bad">💸 −${eur(t.penalty)} удържани</span>`);
    else if (Number(t.reward) > 0) meta.push(`<span class="pill gold">🪙 ${eur(t.reward)}</span>`);
    else if (st === 'todo' || st === 'late') meta.push(`<span class="pill">⚠️ иначе −${eur(t.penalty)}</span>`);
    if (t.due_time && st !== 'missed') meta.push(`<span class="pill ${st === 'late' ? 'bad' : ''}">${st === 'late' ? '⏰ Закъсняла · ' : '🕘 до '}${esc(t.due_time)}</span>`);
    if (st === 'skip') meta.push('<span class="pill">Пропусната</span>');
    return `<button type="button" class="task ${st} ${compact ? 'compact' : ''}" data-task="${t.id}">
      ${tile(t.emoji, t.color)}
      <span class="grow"><span class="tt">${esc(t.title)}</span>${meta.length ? `<span class="meta">${meta.join('')}</span>` : ''}</span>
      <span class="box" aria-label="${st === 'done' ? 'Свършена' : 'Несвършена'}">${st === 'done' ? '✓' : ''}</span>
    </button>`;
  }
  function weekGrid(kidId) {
    const td = today(); const cells = [];
    for (let i = 6; i >= 0; i--) {
      const day = addDays(td, -i);
      const act = S.weekTasks.filter((t) => t.kid_id === kidId && t.day === day && t.status !== 'skipped');
      if (!act.length) { cells.push(`<div class="c" style="background:var(--surface-2);color:var(--ink-3)">${DOW[isoDow(day) - 1]}<b aria-hidden="true">·</b><span>—</span></div>`); continue; }
      const v = Math.round(act.filter((t) => t.status === 'done').length / act.length * 100);
      const bg = v === 100 ? 'var(--ok)' : v >= 75 ? 'var(--gold)' : 'var(--bad)';
      const fg = v >= 75 && v < 100 ? '#3a2600' : '#fff';
      const ic = v === 100 ? '🌟' : v >= 75 ? '👍' : day === td ? '⏳' : '😬';
      cells.push(`<div class="c" style="background:${bg};color:${fg}">${DOW[isoDow(day) - 1]}<b aria-hidden="true">${ic}</b><span class="num">${v}%</span></div>`);
    }
    return `<div class="week">${cells.join('')}</div>`;
  }
  function historyItems(kidId, limit) {
    const td = today();
    const items = [];
    S.hist.filter((t) => t.kid_id === kidId).forEach((t) => {
      if (t.status === 'done' && Number(t.reward) > 0) items.push({ at: t.day + 'T' + (t.done_at || '').slice(11, 19), day: t.day, title: t.title, e: t.emoji, amt: Number(t.reward) });
      if (t.status === 'pending' && t.day < td) items.push({ at: t.day + 'T23:59', day: t.day, title: 'Не е свършена: ' + t.title, e: t.emoji, amt: -Number(t.penalty) });
    });
    S.ledger.filter((l) => l.kid_id === kidId).forEach((l) => {
      const label = l.kind === 'payout' ? 'Изплатена заплата' : l.kind === 'bonus' ? 'Бонус' : 'Удръжка';
      items.push({ at: l.created_at, day: ymd(new Date(l.created_at)), title: label + (l.note ? ': ' + l.note : ''), e: l.kind === 'payout' ? '💸' : l.kind === 'bonus' ? '🎁' : '➖', amt: l.kind === 'bonus' ? Number(l.amount) : -Number(l.amount), payout: l.kind === 'payout', id: l.id });
    });
    items.sort((a, b) => b.at.localeCompare(a.at));
    return items.slice(0, limit || 40);
  }
  function histHTML(kidId, canDelete) {
    const items = historyItems(kidId);
    if (!items.length) return '<div class="card empty">Още няма история. Отметни първата си задача! 🚀</div>';
    return `<div class="card hist">${items.map((it) => `<div class="it">
      <span class="dot" style="background:${it.payout ? 'var(--gold-soft)' : it.amt < 0 ? 'var(--bad-soft)' : 'var(--ok-soft)'}" aria-hidden="true">${esc(it.e)}</span>
      <div class="grow"><div style="font-weight:900">${esc(it.title)}</div><div class="muted small">${it.day === today() ? 'Днес' : fmtShort(it.day)}</div></div>
      <span class="num ${it.payout ? '' : it.amt < 0 ? 'minus' : 'plus'}">${it.amt > 0 ? '+' : ''}${eur(it.amt)}</span>
      ${canDelete && it.id ? `<button type="button" class="iconbtn sm-x" data-del-ledger="${it.id}" aria-label="Изтрий записа">✕</button>` : ''}
    </div>`).join('')}</div>`;
  }

  // =====================================================================
  //  Екрани: настройка, вход, регистрация
  // =====================================================================
  function configScreen() {
    return `<div class="center-col">
      <div class="logo" aria-hidden="true">✅</div>
      <h1 class="display h1">Задачки</h1>
      <p class="muted">Приложението още не е свързано с базата данни.</p>
      <div class="card stack" style="margin-top:18px;text-align:left">
        <label class="field" for="cfgUrl">Supabase адрес (Project URL)<input class="input" id="cfgUrl" placeholder="https://xxxx.supabase.co" autocomplete="off"></label>
        <label class="field" for="cfgKey">Публичен ключ (anon / publishable key)<input class="input" id="cfgKey" placeholder="eyJ… или sb_publishable_…" autocomplete="off"></label>
        <button type="button" class="btn block" data-act="save-config">Свържи</button>
      </div>
      <button type="button" class="btn soft block" style="margin-top:12px" data-act="demo">👀 Пробвай демото</button>
      <p class="muted small" style="margin-top:10px">Демото работи само в този браузър, с измислени деца и задачи.</p>
    </div>`;
  }
  function loginScreen() {
    const demo = S.store.kind === 'demo';
    return `<div class="center-col">
      <div class="logo" aria-hidden="true">✅</div>
      <h1 class="display h1">Задачки</h1>
      <p class="muted">Добре дошли у дома 👋</p>
      ${demo ? `<div class="note" style="margin-top:16px;text-align:left">👀 <b>Демо режим.</b> Влез като някой от семейството:</div>
        <div class="profiles" style="margin-top:12px">${S.store.demoUsers().map((u) => `<button type="button" class="profile" data-demo-login="${esc(u.email)}" style="background:${u.kid ? grad(u.kid) : 'linear-gradient(135deg, #2a1f3d, #5b3f8c)'}">
          <span class="avatar lg">${u.kid ? esc(u.kid.avatar) : '👨‍👩‍👧‍👧'}</span><span class="name">${u.kid ? esc(u.kid.name) : 'Родител'}</span></button>`).join('')}</div>
        <button type="button" class="btn plain block" style="margin-top:14px" data-act="exit-demo">Излез от демото</button>`
      : `<form class="card stack" style="margin-top:18px;text-align:left" data-form="login">
        <label class="field" for="lEmail">Имейл<input class="input" id="lEmail" type="email" autocomplete="email" autocapitalize="none" value="${esc(S.lastEmail || '')}" required></label>
        <label class="field" for="lPass">Парола<input class="input" id="lPass" type="password" autocomplete="current-password" required></label>
        ${S.error ? `<p class="err">${esc(S.error)}</p>` : ''}
        <button type="submit" class="btn block" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Влизане…' : 'Вход'}</button>
      </form>
      <button type="button" class="btn soft block" style="margin-top:12px" data-act="go-register">✨ Нямам профил · Регистрация</button>`}
    </div>`;
  }
  function registerScreen() {
    const r = S.reg; const isP = r.role === 'parent';
    const kid = S.profiles.find((k) => k.id === r.role);
    const roles = [{ id: 'parent', avatar: '👨‍👩‍👧‍👧', name: 'Родител', g: 'linear-gradient(135deg, #2a1f3d, #5b3f8c)' }]
      .concat(S.profiles.map((k) => ({ id: k.id, avatar: k.avatar, name: k.name, g: grad(k) })));
    return `<p class="hello">Нов профил</p>
      <h1 class="display h1">Регистрация</h1>
      <p class="label">1 · Кой си ти?</p>
      <div class="roles">${roles.map((x) => `<button type="button" class="profile role ${r.role === x.id ? 'on' : ''}" data-role="${x.id}" style="background:${x.g}" aria-pressed="${r.role === x.id}">
        <span class="avatar">${esc(x.avatar)}</span><span class="name">${esc(x.name)}</span></button>`).join('')}</div>
      <form class="stack" data-form="register" style="margin-top:6px">
        ${isP ? `<label class="field" for="rName">Как да те наричат децата?<input class="input" id="rName" placeholder="напр. Мама или Тате" required></label>` : ''}
        <p class="note">🔒 ${isP ? 'Профил „Родител“ може да се създаде само с одобрените имейли на родителите.' : `Профилът на ${esc(kid ? kid.name : '')} може да се създаде само с нейния имейл.`}</p>
        <p class="label" style="margin-top:6px">2 · Вход</p>
        <label class="field" for="rEmail">Имейл<input class="input" id="rEmail" type="email" autocomplete="email" autocapitalize="none" required></label>
        <label class="field" for="rPass">Парола<input class="input" id="rPass" type="password" autocomplete="new-password" minlength="6" required placeholder="поне 6 символа"></label>
        ${S.error ? `<p class="err">${esc(S.error)}</p>` : ''}
        <button type="submit" class="btn block" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Създаване…' : 'Създай профил'}</button>
        <button type="button" class="btn soft block" data-act="go-login">Вече имам профил · Вход</button>
      </form>`;
  }

  // =====================================================================
  //  Екрани на детето
  // =====================================================================
  function kidBanner(k, withProgress) {
    const list = S.tasks.filter((t) => t.kid_id === k.id && t.status !== 'skipped');
    const done = list.filter((t) => t.status === 'done').length;
    const pct = list.length ? Math.round(done / list.length * 100) : 0;
    const stars = Math.round(pct / 20);
    const w = wallet(k.id);
    const earnedToday = list.filter((t) => t.status === 'done').reduce((s, t) => s + Number(t.reward), 0);
    return `<section class="banner" style="background:${grad(k)}">
      <div class="row">
        <span class="avatar">${esc(k.avatar)}</span>
        <div class="grow"><div class="small" style="opacity:.9">${fmtDay(today())}</div><h1 class="display h2">Здравей, ${esc(k.name)}!</h1></div>
        <div class="wallet"><b class="num">${eur(w.balance)}</b><span>🪙 касичка</span></div>
      </div>
      ${withProgress ? `<div class="banner-progress">
        <div class="ring" style="--p:${pct}"><span class="num">${done}/${list.length}</span></div>
        <div class="grow">
          <div class="stars" aria-label="${stars} от 5 звезди">${'⭐'.repeat(stars)}<span style="opacity:.35">${'⭐'.repeat(5 - stars)}</span></div>
          <div style="font-weight:900;margin-top:2px">${!list.length ? 'Днес няма задачи' : done === list.length ? 'Всичко е свършено!' : `Още ${list.length - done} до пълния ден`}</div>
          <div class="small" style="opacity:.9">Днес изкара ${eur(earnedToday)}</div>
        </div>
      </div>` : ''}
    </section>`;
  }
  function kidTasksView(k) {
    const list = sortTasks(S.tasks.filter((t) => t.kid_id === k.id && t.status !== 'skipped'));
    const late = list.filter((t) => stateOf(t) === 'late').length;
    const left = list.filter((t) => t.status !== 'done').length;
    const w = wallet(k.id);
    return kidBanner(k, true) + `
      ${late ? `<div class="alert"><span class="big wiggle" aria-hidden="true">⏰</span>${late === 1 ? 'Една задача закъснява!' : late + ' задачи закъсняват!'}</div>`
        : list.length && left === 0 ? `<div class="alert ok"><span class="big" aria-hidden="true">🏆</span>Супер ден! Всичко е свършено.</div>` : ''}
      ${w.atRisk > 0 ? `<div class="alert gold"><span class="big" aria-hidden="true">🪙</span>Ако не свършиш задачите днес, губиш ${eur(w.atRisk)} от седмицата.</div>` : ''}
      <p class="label">📋 Задачите ми днес</p>
      ${list.length ? `<div class="stack">${list.map((t) => taskHTML(t)).join('')}</div>` : '<div class="card empty"><div class="big">🌤️</div>Днес нямаш задачи. Почивка!</div>'}
      ${pushBanner()}
      <p class="muted small" style="margin-top:14px">Докосни задача, за да я отметнеш. 🔴 Червено = още не е свършена.</p>`;
  }
  function kidWalletView(k) {
    const w = wallet(k.id);
    return kidBanner(k, false) + `
      <div class="hero" style="margin-top:14px">
        <span class="coin" aria-hidden="true">🐷</span>
        <div class="small" style="font-weight:900">В касичката ти</div>
        <div class="big num">${eur(w.balance)}</div>
        <div class="small" style="font-weight:800">Тази седмица: <b class="num">${eur(w.thisWeek.net)}</b>${w.thisWeek.lost ? ` · удържани ${eur(w.thisWeek.lost)}` : ''} · заплата в неделя 💸</div>
      </div>
      <p class="label">🧾 История</p>
      ${histHTML(k.id, false)}`;
  }
  function kidWeekView(k) {
    return kidBanner(k, false) + `<p class="label">📅 Последните 7 дни</p>${weekGrid(k.id)}
      <p class="muted small" style="margin-top:10px">🌟 всичко свършено · 👍 почти · 😬 останали са задачи</p>`;
  }
  function kidMeView(k) {
    return kidBanner(k, false) + `
      <p class="label">🎨 Моят вид</p>
      <div class="card stack">
        <div class="emoji-grid">${AVATARS.map((a) => `<button type="button" class="${a === k.avatar ? 'on' : ''}" data-my-avatar="${a}" aria-label="${a}">${a}</button>`).join('')}</div>
        <div class="row wrap" style="gap:10px">${KID_GRADS.map(([a, b]) => `<button type="button" class="color-dot ${a === k.color && b === k.color2 ? 'on' : ''}" data-my-color="${a}|${b}" style="background:linear-gradient(135deg, ${a}, ${b})" aria-label="Цвят"></button>`).join('')}</div>
      </div>
      <p class="label">🔔 Известия</p>
      ${pushCard()}
      <p class="label">👤 Профил</p>
      <div class="card stack">
        <div class="muted small">Влязла си като ${esc(S.me.email)}</div>
        <button type="button" class="btn plain block" data-act="logout">Изход</button>
      </div>`;
  }

  // =====================================================================
  //  Екрани на родителя
  // =====================================================================
  function head(ic, title, extra, color) {
    return `<div class="page-head"><span class="ic" style="${color ? `background:${color};box-shadow:0 4px 0 color-mix(in srgb, ${color} 60%, #000)` : ''}" aria-hidden="true">${ic}</span>
      <div class="grow"><p class="muted small">Родителски панел</p><h1 class="display h2">${title}</h1></div>${extra || ''}</div>`;
  }
  function parentTodayView() {
    const td = today(); const d = S.day;
    const lbl = d === td ? 'днес' : d === addDays(td, 1) ? 'утре' : d === addDays(td, -1) ? 'вчера' : '';
    return head('🏠', 'Задачите у дома') + `
      <div class="daynav">
        <button type="button" class="iconbtn" data-day="-1" aria-label="Предишен ден">‹</button>
        <button type="button" class="d" data-act="day-today">${fmtDay(d)}${lbl ? ' · ' + lbl : ''}</button>
        <button type="button" class="iconbtn" data-day="1" aria-label="Следващ ден">›</button>
      </div>
      ${d > td ? `<p class="note" style="margin-bottom:14px">🌙 План за ${lbl || fmtShort(d)}. Постоянните задачи вече са тук. Добавете останалите с „+ Добави задачи“.</p>` : ''}
      ${d < td ? `<p class="note" style="margin-bottom:14px">📜 Минал ден. Несвършените задачи са удържани. Ако някоя е свършена, но не е отметната, докоснете я и я отбележете.</p>` : ''}
      ${S.kids.map((k) => {
        const list = sortTasks(S.tasks.filter((t) => t.kid_id === k.id));
        const act = list.filter((t) => t.status !== 'skipped');
        const done = act.filter((t) => t.status === 'done').length;
        const w = wallet(k.id);
        return `<section class="card kidcard">
          <div class="kidhead" style="background:${grad(k)}">
            <span class="avatar sm">${esc(k.avatar)}</span>
            <div class="grow"><b>${esc(k.name)}</b><div class="small num">${done} от ${act.length} свършени</div></div>
            <span class="pill gold num">🪙 ${eur(w.balance)}</span>
          </div>
          <div class="progress" style="margin-bottom:12px"><i style="width:${act.length ? done / act.length * 100 : 0}%"></i></div>
          ${list.length ? `<div class="stack">${list.map((t) => taskHTML(t, true)).join('')}</div>` : '<p class="muted small center">Няма задачи за този ден.</p>'}
          <button type="button" class="btn sm block" style="margin-top:12px;background:${k.color};box-shadow:0 4px 0 color-mix(in srgb, ${k.color} 60%, #000)" data-add="${k.id}">+ Добави задачи за ${esc(k.name)}</button>
        </section>`;
      }).join('')}
      ${S.kids.length ? '' : '<div class="card empty"><div class="big">👧</div>Още няма въведени деца. Виж README.md, стъпка 3.</div>'}`;
  }
  function daysText(t) {
    if (!t.repeat_days.length) return 'Задавате я, когато трябва';
    if (t.repeat_days.length === 7) return 'Всеки ден';
    const s = [...t.repeat_days].sort().join();
    if (s === '1,2,3,4,5') return 'Делнични дни';
    if (s === '6,7') return 'Събота и неделя';
    return [...t.repeat_days].sort().map((d) => DOW[d - 1]).join(', ');
  }
  function timesText(t) {
    const extra = Object.entries(t.day_times || {}).filter(([, v]) => v);
    if (!t.due_time && !extra.length) return '';
    const groups = {};
    extra.forEach(([d, v]) => { (groups[v] = groups[v] || []).push(DOW[d - 1]); });
    return ' · ' + [t.due_time ? `🕘 ${t.due_time}` : ''].concat(Object.entries(groups).map(([v, ds]) => `${ds.join(', ')} ${v}`)).filter(Boolean).join(', ');
  }
  const penaltyOfTpl = (t) => (t.penalty != null ? Number(t.penalty) : Number(t.reward) > 0 ? Number(t.reward) : Number(S.settings.unpaid_penalty));
  function parentListView() {
    const row = (t) => `<button type="button" class="list-row" data-edit-tpl="${t.id}" style="${t.active ? '' : 'opacity:.5'}">
      ${tile(t.emoji, t.color)}
      <div class="grow" style="text-align:left"><b>${esc(t.title)}</b><div class="muted small">${daysText(t)}${timesText(t)}${t.kid_ids.length ? ' · ' + t.kid_ids.map((id) => esc((kidById(id) || {}).name || '')).join(', ') : ''}${t.active ? '' : ' · изключена'}</div></div>
      <div class="stack" style="gap:4px;align-items:flex-end">
        ${Number(t.reward) > 0 ? `<span class="pill gold num">🪙 ${eur(t.reward)}</span>` : ''}
        <span class="pill num">−${eur(penaltyOfTpl(t))}</span>
      </div>
    </button>`;
    const rec = S.templates.filter((t) => t.repeat_days.length);
    const man = S.templates.filter((t) => !t.repeat_days.length);
    return head('📋', 'Списък задачи', `<button type="button" class="btn sm" data-edit-tpl="new">+ Нова</button>`, '#ff8a3d') + `
      <p class="muted small">Сумата вдясно е удръжката, ако задачата не е свършена до края на деня.</p>
      <p class="label">🔁 Появяват се сами</p>
      <div class="stack">${rec.map(row).join('') || '<p class="muted small">Няма.</p>'}</div>
      <p class="label">✋ Задавате ги, когато трябва</p>
      <div class="stack">${man.map(row).join('') || '<p class="muted small">Няма.</p>'}</div>`;
  }
  function parentWalletsView() {
    return head('💰', 'Портфейли', '', '#e0a000') + `
      <p class="note">Седмична заплата (понеделник – неделя). Несвършена задача с пари отнема сумата си, а задача без пари — ${eur(S.settings.unpaid_penalty)}. Седмицата не пада под 0.</p>
      ${S.kids.map((k) => {
        const w = wallet(k.id);
        return `<section class="card kidcard" style="margin-top:16px">
          <div class="kidhead" style="background:${grad(k)}"><span class="avatar sm">${esc(k.avatar)}</span><b class="grow">${esc(k.name)}</b></div>
          <div class="row" style="align-items:flex-end">
            <div class="grow"><div class="muted small">За изплащане</div><div class="display num" style="font-size:34px;font-weight:900">${eur(w.balance)}</div></div>
            <div style="text-align:right" class="small">
              <div class="muted">Тази седмица</div>
              <div class="plus num">+${eur(w.thisWeek.earned + w.thisWeek.bonus)}</div>
              <div class="minus num">−${eur(w.thisWeek.lost + w.thisWeek.deduction)}</div>
            </div>
          </div>
          ${w.atRisk ? `<p class="muted small" style="margin-top:6px">Днес още може да загуби ${eur(w.atRisk)} за несвършени задачи.</p>` : ''}
          <div class="row" style="margin-top:12px">
            <button type="button" class="btn gold grow" data-pay="${k.id}" ${w.balance > 0 ? '' : 'disabled'}>💸 Изплати ${eur(w.balance)}</button>
            <button type="button" class="btn plain" data-adjust="${k.id}">± Сума</button>
          </div>
          <details style="margin-top:12px"><summary class="small" style="font-weight:900;cursor:pointer">🧾 История</summary><div style="margin-top:10px">${histHTML(k.id, true)}</div></details>
        </section>`;
      }).join('')}
      <p class="label">📅 Последните 7 дни</p>
      ${S.kids.map((k) => `<div style="margin-bottom:12px"><div class="row small" style="margin-bottom:6px"><span aria-hidden="true">${esc(k.avatar)}</span><b>${esc(k.name)}</b></div>${weekGrid(k.id)}</div>`).join('')}`;
  }
  function parentSettingsView() {
    const s = S.settings;
    const registered = (kidId) => S.members.some((m) => m.kid_id === kidId);
    return head('⚙️', 'Настройки', '', '#19b867') + `
      <p class="label">👨‍👩‍👧‍👧 Семейството</p>
      <div class="card stack" style="gap:8px">
        ${S.members.filter((m) => m.role === 'parent').map((m) => `<div class="row small">${tile('🧑', '#c9e7ff')}<div class="grow"><b>${esc(m.display_name || 'Родител')}</b><div class="muted">${esc(m.email)}</div></div><span class="pill ok">${m.user_id === S.me.user_id ? 'ти' : 'родител'}</span></div>`).join('')}
        ${S.kids.map((k) => `<button type="button" class="row small list-plain" data-edit-kid="${k.id}">${tile(k.avatar, k.color + '55')}<div class="grow" style="text-align:left"><b>${esc(k.name)}</b><div class="muted">${registered(k.id) ? esc((S.members.find((m) => m.kid_id === k.id) || {}).email || '') : 'още не е регистрирана'}</div></div><span class="pill ${registered(k.id) ? 'ok' : ''}">${registered(k.id) ? 'свързана ✓' : 'чака'}</span></button>`).join('')}
        <p class="muted small">Само одобрените имейли могат да се регистрират. Ново лице се добавя в Supabase (README.md, стъпка 3).</p>
      </div>

      <p class="label">⏰ Напомняния и удръжки</p>
      <form class="card stack" data-form="settings">
        <label class="field" for="sBefore">Известие преди часа на задача (минути)<input class="input" id="sBefore" type="number" min="0" max="120" step="5" value="${esc(s.before_minutes)}"></label>
        <label class="field" for="sKidTimes">Общи напомняния за децата (часове, със запетая)<input class="input" id="sKidTimes" value="${esc((s.kid_reminder_times || []).join(', '))}" placeholder="16:00, 19:00"></label>
        <label class="field" for="sParent">Вечерно напомняне за родителите<input class="input" id="sParent" type="time" value="${esc(s.parent_reminder_time || '')}"></label>
        <label class="field" for="sPenalty">Удръжка за несвършена задача без пари (${esc(cur())})<input class="input" id="sPenalty" type="number" min="0" step="0.10" value="${esc(s.unpaid_penalty)}"></label>
        <button type="submit" class="btn block">Запази</button>
      </form>

      <p class="label">🔔 Известия на този телефон</p>
      ${pushCard()}

      <details class="card" style="margin-top:12px"><summary style="font-weight:900;cursor:pointer">🛠️ Ключове за известията (еднократна настройка)</summary>
        <div class="stack" style="margin-top:12px">
          <p class="small muted">Нужни са веднъж, за да работят известията на всички телефони. Виж README.md, стъпка 5.</p>
          ${s.vapid_public ? `<div class="small"><b>Публичен ключ:</b><div class="keybox mono">${esc(s.vapid_public)}</div></div>` : '<p class="small"><b>Още няма ключове.</b></p>'}
          <div id="vapidOut"></div>
          <button type="button" class="btn plain block" data-act="gen-vapid">${s.vapid_public ? 'Генерирай нови ключове' : 'Генерирай ключове'}</button>
        </div>
      </details>

      <p class="label">👤 Профил</p>
      <div class="card stack">
        <form class="row" data-form="myname"><label class="field grow" for="myName">Името ми<input class="input" id="myName" value="${esc(S.me.display_name || '')}"></label><button class="btn" type="submit" style="align-self:flex-end">Запази</button></form>
        <div class="muted small">Влязъл/влязла си като ${esc(S.me.email)}</div>
        <button type="button" class="btn plain block" data-act="logout">Изход</button>
      </div>
      <p class="muted small center" style="margin-top:16px">Задачки · ${S.store.kind === 'demo' ? 'демо режим' : 'свързано със Supabase'}</p>`;
  }

  // =====================================================================
  //  Push известия
  // =====================================================================
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let pushState = 'unknown';
  async function checkPush() {
    if (!pushSupported()) { pushState = isIOS() && !isStandalone() ? 'ios-install' : 'unsupported'; return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      pushState = sub && Notification.permission === 'granted' ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off';
    } catch (_) { pushState = 'off'; }
  }
  function pushCard() {
    const msg = {
      on: ['✅ Известията са включени на този телефон.', '<button type="button" class="btn plain block" data-act="push-off">Изключи</button>'],
      off: ['Включи известията, за да получаваш напомняния за задачите.', '<button type="button" class="btn block" data-act="push-on">🔔 Включи известията</button>'],
      denied: ['Известията са забранени за този сайт. Разреши ги от настройките на браузъра/телефона.', ''],
      'ios-install': ['На iPhone известията работят само ако приложението е добавено на началния екран: Сподели → „Добави към началния екран“, после го отвори от иконата.', ''],
      unsupported: ['Този браузър не поддържа известия. Опитай с Chrome (Android) или Safari (iPhone, от началния екран).', ''],
      unknown: ['Проверявам…', ''],
    }[pushState];
    return `<div class="card stack"><p class="small">${msg[0]}</p>${msg[1]}</div>`;
  }
  function pushBanner() {
    if (pushState !== 'off' && pushState !== 'ios-install') return '';
    return `<div class="note" style="margin-top:14px">🔔 ${pushState === 'off' ? 'Включи известията, за да не забравяш задачите.' : 'За известия добави приложението на началния екран.'}
      ${pushState === 'off' ? '<button type="button" class="btn sm" style="margin-top:8px" data-act="push-on">Включи</button>' : ''}</div>`;
  }
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64u = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
  async function pushOn() {
    if (S.store.kind === 'demo') { toast('В демото известията не се изпращат'); return; }
    if (!S.settings.vapid_public) { toast(isParent() ? 'Първо генерирай ключовете по-долу (README, стъпка 5)' : 'Родителят трябва първо да настрои известията'); return; }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { await checkPush(); render(); toast('Известията не са разрешени'); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(S.settings.vapid_public) });
      const j = sub.toJSON();
      await S.store.savePushSub({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
      pushState = 'on'; render(); toast('🔔 Известията са включени');
      reg.showNotification('Задачки', { body: 'Известията работят! 🎉', icon: 'icon-192.png' }).catch(() => {});
    } catch (e) { toast('Неуспешно: ' + friendly(e)); }
  }
  async function pushOff(quiet) {
    try {
      const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
      if (sub) { await S.store.deletePushSub(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
    } catch (_) {}
    pushState = 'off'; if (!quiet) { render(); toast('Известията са изключени'); }
  }
  async function genVapid() {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
    const priv = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d;
    await S.store.saveSettings({ vapid_public: pub });
    S.settings.vapid_public = pub;
    render();
    const out = $('#vapidOut');
    if (out) {
      out.closest('details').open = true;
      out.innerHTML = `<div class="note small stack">
        <b>Копирай тези два реда в Supabase → Edge Functions → Secrets (README, стъпка 5). Частният ключ се показва само сега!</b>
        <div><b>VAPID_PUBLIC_KEY</b><div class="keybox mono">${esc(pub)}</div></div>
        <div><b>VAPID_PRIVATE_KEY</b><div class="keybox mono">${esc(priv)}</div></div>
        <button type="button" class="btn sm" data-copy="VAPID_PUBLIC_KEY=${esc(pub)}\nVAPID_PRIVATE_KEY=${esc(priv)}">📋 Копирай двата</button>
      </div>`;
    }
  }

  // =====================================================================
  //  Листове (sheets) на родителя
  // =====================================================================
  const dayTime = (t, day) => (t.day_times && t.day_times[isoDow(day)]) || t.due_time || null;
  function addSheet(kidId) {
    const k = kidById(kidId);
    const tpls = S.templates.filter((t) => t.active);
    sheet(`<h2>${esc(k.avatar)} Задачи · ${fmtShort(S.day)}</h2>
      <p class="label" style="margin-top:0">За кого</p>
      <div class="chips">${S.kids.map((x) => `<label class="chip-check"><input type="checkbox" name="addKid" value="${x.id}" ${x.id === kidId ? 'checked' : ''}><span>${esc(x.avatar)} ${esc(x.name)}</span></label>`).join('')}</div>
      <p class="label">От списъка</p>
      <div class="stack">${tpls.map((t) => {
        const has = S.tasks.some((x) => x.kid_id === kidId && x.template_id === t.id);
        return `<label class="pick" for="p-${t.id}">${tile(t.emoji, t.color)}
          <span class="grow">${esc(t.title)}${has ? ` <span class="muted small">(вече я има за ${esc(k.name)})</span>` : ''}${dayTime(t, S.day) ? `<span class="muted small"> · ${dayTime(t, S.day)}</span>` : ''}</span>
          ${Number(t.reward) ? `<span class="pill gold num">${eur(t.reward)}</span>` : ''}
          <input type="checkbox" id="p-${t.id}" name="addTpl" value="${t.id}" ${has ? 'disabled' : ''}></label>`;
      }).join('')}</div>
      <p class="label">Или еднократна задача</p>
      <div class="row">
        <input class="input" id="oneEmoji" value="✨" style="width:64px;text-align:center" aria-label="Емоджи">
        <input class="input grow" id="oneTitle" placeholder="напр. Разходи кучето" aria-label="Име на задачата">
        <input class="input" id="oneReward" type="number" min="0" step="0.5" placeholder="€" style="width:80px" aria-label="Сума">
      </div>
      <label class="field" for="addTime" style="margin-top:12px">🕘 Час (по желание, за всички избрани)<input class="input" type="time" id="addTime"><span class="muted small" style="font-weight:700">Известие ${esc(S.settings.before_minutes)} мин преди часа</span></label>
      <div class="row" style="margin-top:16px">
        <button type="button" class="btn plain" data-act="close">Отказ</button>
        <button type="button" class="btn grow" data-act="confirm-add">Добави</button>
      </div>`);
  }
  async function confirmAdd() {
    const kids = $$('input[name=addKid]:checked').map((i) => i.value);
    const tplIds = $$('input[name=addTpl]:checked').map((i) => i.value);
    const time = $('#addTime').value || null;
    const oneTitle = $('#oneTitle').value.trim();
    if (!kids.length) return toast('Избери за кого');
    if (!tplIds.length && !oneTitle) return toast('Избери задача от списъка или напиши еднократна');
    const rows = [];
    for (const kidId of kids) {
      for (const id of tplIds) {
        const t = S.templates.find((x) => x.id === id);
        if (S.tasks.some((x) => x.kid_id === kidId && x.template_id === id)) continue;
        rows.push({ kid_id: kidId, day: S.day, template_id: t.id, title: t.title, emoji: t.emoji, color: t.color, reward: Number(t.reward), penalty: penaltyOfTpl(t), due_time: time || dayTime(t, S.day) });
      }
      if (oneTitle) {
        const reward = Math.max(0, Number($('#oneReward').value) || 0);
        rows.push({ kid_id: kidId, day: S.day, template_id: null, title: oneTitle, emoji: $('#oneEmoji').value.trim() || '✨', color: TILE_COLORS[Math.floor(Math.random() * TILE_COLORS.length)], reward, penalty: reward > 0 ? reward : Number(S.settings.unpaid_penalty), due_time: time });
      }
    }
    try { await S.store.addTasks(rows); $('#modal-root').innerHTML = ''; toast(`✨ Добавени ${plural(rows.length, 'задача', 'задачи')}`); await refresh(true); }
    catch (e) { toast(friendly(e)); }
  }
  function taskSheet(t) {
    const k = kidById(t.kid_id); const st = stateOf(t);
    const tpl = S.templates.find((x) => x.id === t.template_id);
    const recurring = tpl && tpl.repeat_days.includes(isoDow(t.day)) && t.day >= today();
    sheet(`<h2>${esc(t.emoji)} ${esc(t.title)}</h2>
      <p class="muted" style="margin:-6px 0 14px">${esc(k.avatar)} ${esc(k.name)} · ${fmtShort(t.day)} · ${Number(t.reward) ? `носи ${eur(t.reward)}, ` : ''}удръжка ${eur(t.penalty)}</p>
      <div class="row" style="align-items:flex-end;margin-bottom:6px">
        <label class="field grow" for="editTime">🕘 Час на задачата<input class="input" type="time" id="editTime" value="${esc(t.due_time || '')}"></label>
        <button type="button" class="btn" data-settime="${t.id}">Запази</button>
      </div>
      <p class="muted small" style="margin-bottom:14px">${esc(k.name)} получава известие ${esc(S.settings.before_minutes)} мин преди часа и още едно в самия час, ако не е отметнала задачата.</p>
      <div class="stack">
        ${t.status === 'done'
          ? `<button type="button" class="btn plain block" data-set="${t.id}:pending">↩️ Не е свършена</button>`
          : `<button type="button" class="btn ok block" data-set="${t.id}:done">✓ Отбележи като свършена${st === 'missed' ? ' (връща удръжката)' : ''}</button>`}
        ${t.status === 'skipped'
          ? `<button type="button" class="btn plain block" data-set="${t.id}:pending">Върни задачата</button>`
          : `<button type="button" class="btn plain block" data-set="${t.id}:skipped">🤒 Пропусни (без пари и без удръжка)</button>`}
        ${recurring ? '' : `<button type="button" class="btn danger block" data-del-task="${t.id}">🗑️ Премахни задачата</button>`}
        <button type="button" class="btn soft block" data-act="close">Затвори</button>
      </div>`);
  }
  function tplSheet(id) {
    const t = id === 'new'
      ? { id: null, title: '', emoji: '✅', color: TILE_COLORS[S.templates.length % TILE_COLORS.length], reward: 0, penalty: null, due_time: null, day_times: {}, repeat_days: [], kid_ids: [], active: true, sort: (S.templates.length + 1) * 10 }
      : JSON.parse(JSON.stringify(S.templates.find((x) => x.id === id)));
    S.edit = t;
    const dayTimes = Object.entries(t.day_times || {}).filter(([, v]) => v);
    sheet(`<h2>${t.id ? 'Редакция на задача' : 'Нова задача'}</h2>
      <form class="stack" data-form="tpl">
        <div class="row">
          <input class="input" id="tEmoji" value="${esc(t.emoji)}" style="width:64px;text-align:center;font-size:24px" aria-label="Емоджи">
          <input class="input grow" id="tTitle" value="${esc(t.title)}" placeholder="Име на задачата" required aria-label="Име на задачата">
        </div>
        <div class="emoji-grid small-grid">${TASK_EMOJIS.map((e) => `<button type="button" data-pick-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}</div>
        <div class="row wrap" style="gap:8px">${TILE_COLORS.map((c) => `<button type="button" class="color-dot sm ${c === t.color ? 'on' : ''}" data-pick-color="${c}" style="background:${c}" aria-label="Цвят"></button>`).join('')}</div>
        <div class="row">
          <label class="field grow" for="tReward">🪙 Носи (${esc(cur())})<input class="input" id="tReward" type="number" min="0" step="0.10" value="${esc(t.reward)}"></label>
          <label class="field grow" for="tPenalty">💸 Удръжка (${esc(cur())})<input class="input" id="tPenalty" type="number" min="0" step="0.10" value="${t.penalty == null ? '' : esc(t.penalty)}" placeholder="автоматично"></label>
        </div>
        <p class="muted small" style="margin-top:-4px">Ако удръжката е празна: равна на сумата, а ако задачата не носи пари — ${eur(S.settings.unpaid_penalty)}.</p>
        <p class="label" style="margin:8px 0 0">🔁 Появява се сама в</p>
        <div class="chips">${DOW.map((d, i) => `<label class="chip-check"><input type="checkbox" name="tDay" value="${i + 1}" ${t.repeat_days.includes(i + 1) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
        <div class="row wrap" style="gap:8px">
          <button type="button" class="btn sm plain" data-days="1,2,3,4,5,6,7">Всеки ден</button>
          <button type="button" class="btn sm plain" data-days="1,2,3,4,5">Делнични</button>
          <button type="button" class="btn sm plain" data-days="">Само ръчно</button>
        </div>
        <label class="field" for="tTime">🕘 Час (по желание)<input class="input" id="tTime" type="time" value="${esc(t.due_time || '')}"></label>
        <details ${dayTimes.length ? 'open' : ''}><summary class="small" style="font-weight:900;cursor:pointer">Различен час в някои дни</summary>
          <div class="daytimes">${DOW.map((d, i) => `<label class="field" for="dt${i + 1}">${d}<input class="input" type="time" id="dt${i + 1}" value="${esc((t.day_times || {})[i + 1] || '')}"></label>`).join('')}</div>
        </details>
        <p class="label" style="margin:8px 0 0">👧 За кого</p>
        <div class="chips">${S.kids.map((k) => `<label class="chip-check"><input type="checkbox" name="tKid" value="${k.id}" ${!t.kid_ids.length || t.kid_ids.includes(k.id) ? 'checked' : ''}><span>${esc(k.avatar)} ${esc(k.name)}</span></label>`).join('')}</div>
        <label class="check" for="tActive"><input type="checkbox" id="tActive" ${t.active ? 'checked' : ''}> Активна</label>
        <div class="row" style="margin-top:6px">
          ${t.id ? `<button type="button" class="btn danger" data-del-tpl="${t.id}">🗑️</button>` : ''}
          <button type="button" class="btn plain" data-act="close">Отказ</button>
          <button type="submit" class="btn grow">Запази</button>
        </div>
      </form>`);
  }
  async function saveTpl() {
    const t = S.edit;
    const title = $('#tTitle').value.trim(); if (!title) return toast('Напиши име на задачата');
    const pen = $('#tPenalty').value.trim();
    const day_times = {};
    for (let i = 1; i <= 7; i++) { const v = $('#dt' + i).value; if (v) day_times[i] = v; }
    const kidIds = $$('input[name=tKid]:checked').map((i) => i.value);
    const row = {
      title, emoji: $('#tEmoji').value.trim() || '✅', color: t.color,
      reward: Math.max(0, Number($('#tReward').value) || 0), penalty: pen === '' ? null : Math.max(0, Number(pen) || 0),
      due_time: $('#tTime').value || null, day_times,
      repeat_days: $$('input[name=tDay]:checked').map((i) => Number(i.value)),
      kid_ids: kidIds.length === S.kids.length ? [] : kidIds, active: $('#tActive').checked, sort: t.sort,
    };
    if (t.id) row.id = t.id;
    try {
      const saved = await S.store.saveTemplate(row);
      // обнови днешните и бъдещите несвършени задачи от този шаблон
      const fut = S.tasks.concat(S.hist).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i && x.template_id === saved.id && x.day >= today() && x.status === 'pending');
      for (const x of fut) await S.store.updateTask(x.id, { title: row.title, emoji: row.emoji, color: row.color, reward: row.reward, penalty: penaltyOfTpl(row), due_time: dayTime(row, x.day) });
      $('#modal-root').innerHTML = ''; toast('Запазено ✓'); await refresh(true);
    } catch (e) { toast(friendly(e)); }
  }
  function kidSheet(id) {
    const k = { ...kidById(id) }; S.edit = k;
    sheet(`<h2>${esc(k.avatar)} ${esc(k.name)}</h2>
      <form class="stack" data-form="kid">
        <label class="field" for="kName">Име<input class="input" id="kName" value="${esc(k.name)}" required></label>
        <div class="emoji-grid">${AVATARS.map((a) => `<button type="button" class="${a === k.avatar ? 'on' : ''}" data-kid-avatar="${a}">${a}</button>`).join('')}</div>
        <div class="row wrap" style="gap:10px">${KID_GRADS.map(([a, b]) => `<button type="button" class="color-dot ${a === k.color ? 'on' : ''}" data-kid-color="${a}|${b}" style="background:linear-gradient(135deg, ${a}, ${b})" aria-label="Цвят"></button>`).join('')}</div>
        <div class="row"><button type="button" class="btn plain" data-act="close">Отказ</button><button type="submit" class="btn grow">Запази</button></div>
      </form>`);
  }
  function adjustSheet(kidId) {
    const k = kidById(kidId);
    sheet(`<h2>± Сума за ${esc(k.name)}</h2>
      <form class="stack" data-form="adjust" data-kid="${kidId}">
        <div class="row">
          <label class="chip-check grow"><input type="radio" name="adjKind" value="bonus" checked><span>🎁 Бонус</span></label>
          <label class="chip-check grow"><input type="radio" name="adjKind" value="deduction"><span>➖ Удръжка</span></label>
        </div>
        <label class="field" for="adjAmt">Сума (${esc(cur())})<input class="input" id="adjAmt" type="number" min="0.1" step="0.10" required></label>
        <label class="field" for="adjNote">Бележка<input class="input" id="adjNote" placeholder="напр. помогна на баба"></label>
        <div class="row"><button type="button" class="btn plain" data-act="close">Отказ</button><button type="submit" class="btn grow">Запази</button></div>
      </form>`);
  }
  function paySheet(kidId) {
    const k = kidById(kidId); const w = wallet(kidId);
    const weeks = Object.entries(w.weeks).filter(([, x]) => x.remaining > 0).sort();
    sheet(`<h2>💸 Заплата за ${esc(k.name)}</h2>
      <div class="hero" style="margin-bottom:14px"><div class="small" style="font-weight:900">За изплащане</div><div class="big num">${eur(w.balance)}</div></div>
      <div class="card hist">${weeks.map(([ws, x]) => `<div class="it"><div class="grow"><b>Седмица от ${fmtShort(ws)}</b><div class="muted small">+${eur(x.earned + x.bonus)} · −${eur(x.lost + x.deduction)}${x.paid ? ` · вече изплатени ${eur(x.paid)}` : ''}</div></div><b class="num">${eur(x.remaining)}</b></div>`).join('')}</div>
      <p class="muted small" style="margin-top:10px">Дай парите и натисни „Изплатих“. Касичката се нулира, историята остава.</p>
      <div class="row" style="margin-top:12px"><button type="button" class="btn plain" data-act="close">Отказ</button><button type="button" class="btn gold grow" data-confirm-pay="${kidId}">Изплатих ${eur(w.balance)}</button></div>`);
  }

  // =====================================================================
  //  Рендиране
  // =====================================================================
  function render() {
    const app = $('#app'); const nav = $('#nav');
    nav.hidden = true;
    if (S.screen === 'boot') { app.innerHTML = '<div class="loading"><div class="spinner"></div></div>'; return; }
    if (S.screen === 'config') { app.innerHTML = configScreen(); return; }
    if (S.screen === 'login') { app.innerHTML = loginScreen(); return; }
    if (S.screen === 'register') { app.innerHTML = registerScreen(); return; }
    if (S.screen === 'nomember') {
      app.innerHTML = `<div class="center-col"><div class="logo">🤔</div><h1 class="display h2">Профилът не е свързан</h1><p class="muted">Този имейл няма роля в семейството. Провери README.md, стъпка 3.</p><button type="button" class="btn block" style="margin-top:16px" data-act="logout">Изход</button></div>`;
      return;
    }
    let items, html;
    if (isParent()) {
      const t = S.tab || 'today';
      html = t === 'list' ? parentListView() : t === 'wallets' ? parentWalletsView() : t === 'settings' ? parentSettingsView() : parentTodayView();
      items = [['today', '🏠', 'Днес', '#7c4dff'], ['list', '📋', 'Задачи', '#ff8a3d'], ['wallets', '💰', 'Портфейли', '#e0a000'], ['settings', '⚙️', 'Настройки', '#19b867']];
    } else {
      const k = myKid(); const t = S.tab || 'tasks';
      if (!k) { app.innerHTML = '<div class="card empty">Профилът на детето не е намерен.</div>'; return; }
      html = t === 'wallet' ? kidWalletView(k) : t === 'week' ? kidWeekView(k) : t === 'me' ? kidMeView(k) : kidTasksView(k);
      items = [['tasks', '✅', 'Задачи', k.color], ['wallet', '🐷', 'Касичка', '#ff9f1c'], ['week', '📅', 'Седмица', '#7c4dff'], ['me', esc(k.avatar), 'Аз', k.color2]];
    }
    const curTab = S.tab || items[0][0];
    app.innerHTML = (S.error ? `<div class="alert" style="margin-bottom:12px">⚠️ ${esc(S.error)}</div>` : '') + html;
    nav.hidden = false;
    nav.innerHTML = `<div class="tabs-in">${items.map(([id, i, l, c]) => `<button type="button" data-tab="${id}" style="--tabc:${c}" class="${curTab === id ? 'on' : ''}" aria-current="${curTab === id ? 'page' : 'false'}"><span class="i" aria-hidden="true">${i}</span>${l}</button>`).join('')}</div>`;
  }

  // =====================================================================
  //  Действия
  // =====================================================================
  async function afterLogin() {
    S.me = await S.store.me();
    if (!S.me) { S.screen = 'nomember'; render(); return; }
    S.screen = 'main'; S.tab = null; S.day = today(); S.error = null;
    await refresh();
    checkPush().then(render);
  }
  async function toggleKidTask(el, t) {
    const done = t.status !== 'done';
    const prev = { ...t };
    Object.assign(t, { status: done ? 'done' : 'pending' });
    S.hist.forEach((h) => { if (h.id === t.id) h.status = t.status; });
    S.weekTasks.forEach((h) => { if (h.id === t.id) h.status = t.status; });
    const tot = S.totals.find((x) => x.kid_id === t.kid_id && x.week_start === weekStart(t.day));
    if (tot) tot.earned = r2(Number(tot.earned) + (done ? 1 : -1) * Number(t.reward));
    else if (done) S.totals.push({ kid_id: t.kid_id, week_start: weekStart(t.day), earned: Number(t.reward), lost: 0 });
    const rect = el.getBoundingClientRect();
    render();
    if (done) {
      coinPop(rect.right - 60, rect.top, Number(t.reward) > 0 ? `+${eur(t.reward)}` : '👏 Браво!');
      const left = S.tasks.filter((x) => x.kid_id === t.kid_id && x.status === 'pending').length;
      if (left === 0) { confetti(70); toast('🏆 Всичко за днес е свършено!'); } else confetti(16);
    } else toast('Отметката е махната');
    try { await S.store.setMyTask(t.id, done); }
    catch (e) { Object.assign(t, prev); toast(friendly(e)); await refresh(true); }
  }

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('button, .sheet-bg, [data-copy]');
    if (!el) return;
    if (el.classList.contains('sheet-bg')) { if (ev.target === el) closeSheet(); return; }
    const d = el.dataset;
    try {
      if (d.act === 'close') return closeSheet();
      if (d.act === 'save-config') {
        const url = $('#cfgUrl').value.trim(); const key = $('#cfgKey').value.trim();
        if (!/^https:\/\/.+/.test(url) || key.length < 20) return toast('Провери адреса и ключа');
        lsSet('fam-cfg', JSON.stringify({ url, key })); location.reload(); return;
      }
      if (d.act === 'demo') { lsSet('fam-mode', 'demo'); location.reload(); return; }
      if (d.act === 'exit-demo') { lsSet('fam-mode', null); location.reload(); return; }
      if (d.demoLogin) { await S.store.signIn(d.demoLogin); return afterLogin(); }
      if (d.act === 'go-register') {
        S.screen = 'register'; S.error = null; render();
        try { S.profiles = await S.store.publicProfiles(); } catch (e) { S.error = friendly(e); }
        return render();
      }
      if (d.act === 'go-login') { S.screen = 'login'; S.error = null; return render(); }
      if (d.role) { S.reg.role = d.role; S.error = null; return render(); }
      if (d.act === 'logout') { await pushOff(true).catch(() => {}); await S.store.signOut(); S.me = null; S.screen = 'login'; return render(); }
      if (d.tab) { S.tab = d.tab; window.scrollTo(0, 0); return render(); }
      if (d.day) { S.day = addDays(S.day, Number(d.day)); render(); return refresh(true); }
      if (d.act === 'day-today') { S.day = today(); return refresh(true); }
      if (d.task) {
        const t = S.tasks.find((x) => x.id === d.task); if (!t) return;
        if (isParent()) return taskSheet(t);
        if (t.day !== today()) return toast('Може да отмяташ само днешните задачи');
        return toggleKidTask(el, t);
      }
      if (d.set) {
        const [id, status] = d.set.split(':');
        await S.store.updateTask(id, { status, done_at: status === 'done' ? new Date().toISOString() : null, done_by: status === 'done' ? (S.me.user_id || null) : null });
        $('#modal-root').innerHTML = ''; return refresh(true);
      }
      if (d.settime) {
        const v = $('#editTime').value || null;
        await S.store.updateTask(d.settime, { due_time: v });
        $('#modal-root').innerHTML = ''; toast(v ? `🕘 Часът е ${v}` : 'Часът е махнат'); return refresh(true);
      }
      if (d.delTask) { await S.store.deleteTask(d.delTask); $('#modal-root').innerHTML = ''; toast('Премахната'); return refresh(true); }
      if (d.add) return addSheet(d.add);
      if (d.act === 'confirm-add') return confirmAdd();
      if (d.editTpl) return tplSheet(d.editTpl);
      if (d.pickEmoji) { $('#tEmoji').value = d.pickEmoji; return; }
      if (d.pickColor) { S.edit.color = d.pickColor; $$('[data-pick-color]').forEach((b) => b.classList.toggle('on', b === el)); return; }
      if ('days' in d) { const set = d.days ? d.days.split(',') : []; $$('input[name=tDay]').forEach((i) => { i.checked = set.includes(i.value); }); return; }
      if (d.delTpl) {
        if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Сигурно ли? Натисни пак'; return; }
        await S.store.deleteTemplate(d.delTpl); $('#modal-root').innerHTML = ''; toast('Задачата е изтрита от списъка'); return refresh(true);
      }
      if (d.editKid) return kidSheet(d.editKid);
      if (d.kidAvatar) { S.edit.avatar = d.kidAvatar; $$('[data-kid-avatar]').forEach((b) => b.classList.toggle('on', b === el)); return; }
      if (d.kidColor) { [S.edit.color, S.edit.color2] = d.kidColor.split('|'); $$('[data-kid-color]').forEach((b) => b.classList.toggle('on', b === el)); return; }
      if (d.myAvatar) { const k = myKid(); k.avatar = d.myAvatar; render(); return S.store.updateMyLook(k.avatar, k.color, k.color2); }
      if (d.myColor) { const k = myKid(); [k.color, k.color2] = d.myColor.split('|'); render(); return S.store.updateMyLook(k.avatar, k.color, k.color2); }
      if (d.adjust) return adjustSheet(d.adjust);
      if (d.pay) return paySheet(d.pay);
      if (d.confirmPay) {
        const w = wallet(d.confirmPay);
        const rows = Object.entries(w.weeks).filter(([, x]) => x.remaining > 0).map(([ws, x]) => ({ kid_id: d.confirmPay, week_start: ws, kind: 'payout', amount: x.remaining }));
        if (!rows.length) return closeSheet();
        await S.store.addLedger(rows); $('#modal-root').innerHTML = ''; confetti(40); toast(`💸 Изплатени ${eur(w.balance)} на ${kidById(d.confirmPay).name}`);
        return refresh(true);
      }
      if (d.delLedger) {
        if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = '?'; el.setAttribute('aria-label', 'Натисни пак, за да изтриеш'); return; }
        await S.store.deleteLedger(d.delLedger); toast('Записът е изтрит'); return refresh(true);
      }
      if (d.act === 'push-on') return pushOn();
      if (d.act === 'push-off') return pushOff(false);
      if (d.act === 'gen-vapid') return genVapid();
      if ('copy' in d) {
        const text = d.copy.replace(/\\n/g, '\n');
        try { await navigator.clipboard.writeText(text); toast('Копирано 📋'); } catch (_) { toast('Маркирай текста и го копирай ръчно'); }
      }
    } catch (e) { toast(friendly(e)); }
  });

  document.addEventListener('submit', async (ev) => {
    const f = ev.target.closest('form[data-form]'); if (!f) return;
    ev.preventDefault();
    const kind = f.dataset.form;
    try {
      if (kind === 'login') {
        const email = $('#lEmail').value.trim(); const pass = $('#lPass').value;
        if (!email || !pass) return toast('Попълни имейл и парола');
        S.busy = true; S.error = null; S.lastEmail = email; render();
        try { await S.store.signIn(email, pass); } catch (e) { S.busy = false; S.error = friendly(e); render(); if ($('#lEmail')) $('#lEmail').value = email; return; }
        S.busy = false; return afterLogin();
      }
      if (kind === 'register') {
        const r = S.reg; const isP = r.role === 'parent';
        const email = $('#rEmail').value.trim(); const pass = $('#rPass').value; const name = isP ? $('#rName').value.trim() : '';
        S.busy = true; S.error = null; render();
        let res;
        try { res = await S.store.signUp(email, pass, isP ? { role: 'parent', display_name: name } : { role: 'kid', kid_id: r.role }); }
        catch (e) { S.busy = false; S.error = friendly(e); render(); $('#rEmail').value = email; return; }
        S.busy = false;
        if (res.needsConfirm) { S.screen = 'login'; render(); toast('📧 Провери имейла си и натисни линка за потвърждение, после влез.'); return; }
        confetti(40); return afterLogin();
      }
      if (kind === 'tpl') return saveTpl();
      if (kind === 'kid') {
        S.edit.name = $('#kName').value.trim() || S.edit.name;
        await S.store.saveKid(S.edit); $('#modal-root').innerHTML = ''; toast('Запазено ✓'); return refresh(true);
      }
      if (kind === 'adjust') {
        const amount = r2(Number($('#adjAmt').value)); if (!(amount > 0)) return toast('Въведи сума');
        const kindV = ($('input[name=adjKind]:checked') || {}).value || 'bonus';
        await S.store.addLedger([{ kid_id: f.dataset.kid, week_start: weekStart(today()), kind: kindV, amount, note: $('#adjNote').value.trim() || null }]);
        $('#modal-root').innerHTML = ''; toast(kindV === 'bonus' ? '🎁 Бонусът е добавен' : '➖ Удръжката е добавена'); return refresh(true);
      }
      if (kind === 'settings') {
        const times = $('#sKidTimes').value.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)
          .map((x) => (/^\d{1,2}$/.test(x) ? x + ':00' : x)).map((x) => x.replace(/^(\d):/, '0$1:'));
        if (times.some((x) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(x))) return toast('Часовете трябва да са като 16:00, 19:00');
        await S.store.saveSettings({ before_minutes: Math.max(0, Math.min(120, Number($('#sBefore').value) || 0)), kid_reminder_times: times, parent_reminder_time: $('#sParent').value || null, unpaid_penalty: Math.max(0, Number($('#sPenalty').value) || 0) });
        toast('Запазено ✓'); return refresh(true);
      }
      if (kind === 'myname') { await S.store.updateMyName($('#myName').value.trim()); toast('Запазено ✓'); return refresh(true); }
    } catch (e) { toast(friendly(e)); }
  });

  // опресняване: на всеки 30 секунди и при връщане в приложението
  setInterval(() => { if (document.visibilityState === 'visible' && S.screen === 'main' && !$('.sheet-bg')) refresh(true); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.screen === 'main' && !$('.sheet-bg')) { if (!isParent()) S.day = today(); refresh(true); } });

  // =====================================================================
  //  Старт
  // =====================================================================
  async function boot() {
    render();
    const CFG = window.FAM_CONFIG || {};
    let saved = null; try { saved = JSON.parse(lsGet('fam-cfg')); } catch (_) {}
    const url = CFG.SUPABASE_URL || (saved && saved.url);
    const key = CFG.SUPABASE_ANON_KEY || (saved && saved.key);
    if (lsGet('fam-mode') === 'demo' || /[?&]demo\b/.test(location.search)) S.store = demoStore();
    else if (url && key && window.supabase) S.store = supabaseStore(url, key);
    else if (url && key && !window.supabase) { $('#app').innerHTML = '<div class="card empty">Не успях да заредя Supabase. Провери интернета и опитай пак.</div>'; return; }
    else { S.screen = 'config'; return render(); }
    try {
      const user = await S.store.session();
      if (user) return afterLogin();
    } catch (_) {}
    S.screen = 'login'; render();
  }
  window.__fam = S; // за отстраняване на грешки
  boot();
})();
