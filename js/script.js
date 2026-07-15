/* ===========================================================
   CALENDÁRIO EDITORIAL — TRAÇO D
   Arquivo: script.js
   =========================================================== */

/* -----------------------------------------------------------
   1. CONSTANTES
   ----------------------------------------------------------- */
const PLATFORMS = ["Instagram", "Facebook", "LinkedIn", "TikTok", "WhatsApp", "E-mail Marketing", "Site", "YouTube", "Mídia Tradicional"];
const FORMATS   = ["Feed", "Reels", "Stories", "Carrossel", "Vídeo", "Banner", "Newsletter", "Post estático", "Anúncio impresso"];
const STATUSES  = ["Planejado", "Criação", "Aprovação", "Agendado", "Publicado", "Pausado", "Recusado", "Cancelado"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_PT   = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const PLAT_ICON = {
  "Instagram":        "ti-brand-instagram",
  "Facebook":         "ti-brand-facebook",
  "LinkedIn":         "ti-brand-linkedin",
  "TikTok":           "ti-brand-tiktok",
  "WhatsApp":         "ti-brand-whatsapp",
  "E-mail Marketing": "ti-mail",
  "Site":             "ti-world",
  "YouTube":          "ti-brand-youtube",
  "Mídia Tradicional":"ti-news"
};

const STATUS_STYLE = {
  "Planejado": { bg: "#f3f4f6", border: "#e5e7eb", text: "#4b5563", dot: "#9ca3af" },
  "Criação":   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6" },
  "Aprovação": { bg: "#fffbeb", border: "#fde68a", text: "#b45309", dot: "#f59e0b" },
  "Agendado":  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", dot: "#22c55e" },
  "Publicado": { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", dot: "#10b981" },
  "Pausado":   { bg: "#faf5ff", border: "#e9d5ff", text: "#7e22ce", dot: "#a855f7" },
  "Recusado":  { bg: "#fff1f2", border: "#fecdd3", text: "#be123c", dot: "#f43f5e" },
  "Cancelado": { bg: "#f9fafb", border: "#d1d5db", text: "#6b7280", dot: "#9ca3af" }
};

/* -----------------------------------------------------------
   2. ESTADO
   ----------------------------------------------------------- */
let year       = new Date().getFullYear();
let month      = new Date().getMonth();
let entries    = [];
let allEntries = [];
let demands    = [];
let clientName = "Nome do cliente";
let view       = "grid";
let activeTab  = "calendar";
let clientMode = (window.PAGE_MODE === "client");
let filter     = { status: "", platform: "" };
let editEntry  = null;
let isNewEntry = false;
let pendingFiles = [];
let pendingApprovalFiles = [];

/* Multi-cliente (Firebase) */
let currentClientId = null;
let clientsList      = [];
let _unsubEntries = null, _unsubDemands = null, _unsubClient = null;

/* -----------------------------------------------------------
   3. UTILITÁRIOS
   ----------------------------------------------------------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function slugify(str) {
  return (str || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function getClientIdFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return p.get("cliente") || p.get("client") || null;
}
function currentMonthEntries() {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  return allEntries.filter(e => e.date && e.date.startsWith(ym));
}

function fmtDatetime(iso) {
  if (!iso) return "";
  const d  = new Date(iso);
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${dd}/${mm}/${d.getFullYear()} às ${hh}:${mi}`;
}
function formatDateSimple(dateStr) {
  if (!dateStr) return "";
  const [y,m,d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/* -----------------------------------------------------------
   4. PERSISTÊNCIA
   ----------------------------------------------------------- */
function load() {
  if (clientMode) {
    currentClientId = getClientIdFromUrl();
    if (!currentClientId) {
      const c = document.getElementById("content");
      if (c) c.innerHTML = `<div class="empty-state">
        <div class="empty-title">Link inválido</div>
        <div style="font-size:13px">Peça um novo link de acesso à agência.</div>
      </div>`;
      return;
    }
    attachClientListeners(currentClientId);
  } else {
    initClientPicker();
  }
}

/* Conecta os listeners em tempo real do Firestore para um cliente específico */
function attachClientListeners(clientId) {
  if (_unsubEntries) _unsubEntries();
  if (_unsubDemands) _unsubDemands();
  if (_unsubClient)  _unsubClient();

  currentClientId = clientId;

  _unsubClient = db.collection("clients").doc(clientId).onSnapshot(doc => {
    const data = doc.data() || {};
    clientName = data.name || "Nome do cliente";
    const hdr = document.getElementById("hdr-client"); if (hdr) hdr.textContent = clientName;
    const inp = document.getElementById("inp-client");  if (inp) inp.value = clientName;
  }, err => console.error("Erro ao carregar cliente:", err));

  _unsubEntries = db.collection("clients").doc(clientId).collection("entries")
    .onSnapshot(snap => {
      allEntries = snap.docs.map(d => d.data());
      render();
    }, err => console.error("Erro ao carregar publicações:", err));

  _unsubDemands = db.collection("clients").doc(clientId).collection("demands")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      demands = snap.docs.map(d => d.data());
      if (activeTab === "demands") renderDemands();
      updateDemandBadge();
    }, err => console.error("Erro ao carregar demandas:", err));
}

/* Só usado no modo agência: carrega a lista de clientes e permite trocar entre eles */
async function initClientPicker() {
  const sel = document.getElementById("client-select");
  try {
    const snap = await db.collection("clients").orderBy("name").get();
    clientsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Erro ao listar clientes:", err);
    clientsList = [];
  }
  if (sel) sel.innerHTML = clientsList.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  const urlClientId = getClientIdFromUrl();
  let clientId = (urlClientId && clientsList.find(c => c.id === urlClientId)) ? urlClientId : (clientsList[0] ? clientsList[0].id : null);

  if (!clientId) {
    clientId = await createNewClientPrompt();
    if (!clientId) return;
  }
  if (sel) sel.value = clientId;
  switchClient(clientId, false);
}

function onClientPickerChange(id) { switchClient(id, true); }

function switchClient(clientId, updateUrl) {
  currentClientId = clientId;
  if (updateUrl !== false) {
    const url = new URL(window.location.href);
    url.searchParams.set("cliente", clientId);
    history.replaceState(null, "", url);
  }
  attachClientListeners(clientId);
}

function randomClientId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function createNewClientPrompt() {
  const name = prompt("Nome do novo cliente:");
  if (!name || !name.trim()) return null;
  let id = randomClientId();
  try {
    while ((await db.collection("clients").doc(id).get()).exists) { id = randomClientId(); }
    await db.collection("clients").doc(id).set({ name: name.trim() });
  } catch (err) {
    alert("Erro ao criar cliente: " + err.message);
    return null;
  }
  clientsList.push({ id, name: name.trim() });
  const sel = document.getElementById("client-select");
  if (sel) { sel.innerHTML += `<option value="${id}">${name.trim()}</option>`; sel.value = id; }
  return id;
}

async function promptNewClient() {
  const id = await createNewClientPrompt();
  if (id) switchClient(id, true);
}

function copyClientLink() {
  if (!currentClientId) return;
  const url  = new URL(window.location.href);
  const base = url.origin + url.pathname.replace(/agencia\.html$/, "index.html");
  const link = `${base}?cliente=${currentClientId}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link)
      .then(() => alert("Link copiado para a área de transferência:\n\n" + link))
      .catch(() => prompt("Copie o link abaixo:", link));
  } else {
    prompt("Copie o link abaixo:", link);
  }
}

/* -----------------------------------------------------------
   5. MODO CLIENTE / AGÊNCIA
   ----------------------------------------------------------- */
function toggleClientMode() {
  clientMode = !clientMode;
  const app = document.getElementById("app");
  if (app) app.classList.toggle("client-mode", clientMode);

  const btn = document.getElementById("btn-mode-toggle");
  const btnAddPub  = document.getElementById("btn-add-pub");
  const btnSettings = document.getElementById("btn-settings");
  const tabDemands = document.getElementById("tab-demands");
  const filtersBar = document.getElementById("filters-bar");

  if (clientMode) {
    if (btn) { btn.innerHTML = `<i class="ti ti-building" aria-hidden="true"></i> Modo Agência`; btn.classList.add("active-mode"); }
    // Oculta botões internos da agência
    if (btnAddPub)   btnAddPub.style.display   = "none";
    if (btnSettings) btnSettings.style.display = "none";
    if (tabDemands)  tabDemands.style.display  = "none";
    if (filtersBar)  filtersBar.style.display  = "none";
  } else {
    if (btn) { btn.innerHTML = `<i class="ti ti-user" aria-hidden="true"></i> Modo Cliente`; btn.classList.remove("active-mode"); }
    if (btnAddPub)   btnAddPub.style.display   = "";
    if (btnSettings) btnSettings.style.display = "";
    if (tabDemands)  tabDemands.style.display  = "";
    if (filtersBar)  filtersBar.style.display  = "";
    // Volta para calendário se estava em demandas
    if (activeTab === "demands") setTab("calendar");
  }
  renderContent();
}

/* -----------------------------------------------------------
   6. ABAS
   ----------------------------------------------------------- */
function setTab(tab) {
  activeTab = tab;
  document.getElementById("tab-calendar").className = "tab-btn" + (tab === "calendar" ? " on" : "");
  document.getElementById("tab-demands").className  = "tab-btn" + (tab === "demands"  ? " on" : "");
  document.getElementById("section-calendar").style.display = tab === "calendar" ? "" : "none";
  document.getElementById("section-demands").style.display  = tab === "demands"  ? "" : "none";
  if (tab === "demands") renderDemands();
}

/* -----------------------------------------------------------
   7. NAVEGAÇÃO E VISTA
   ----------------------------------------------------------- */
function navMonth(delta) {
  month += delta;
  if (month < 0)  { month = 11; year--; }
  if (month > 11) { month = 0;  year++; }
  render();
}
function setView(v) {
  view = v;
  const gridBtn = document.getElementById("vbtn-grid");
  const listBtn = document.getElementById("vbtn-list");
  if (gridBtn) gridBtn.className = "view-btn" + (v === "grid" ? " on" : "");
  if (listBtn) listBtn.className = "view-btn" + (v === "list" ? " on" : "");
  renderContent();
}

/* -----------------------------------------------------------
   8. FILTROS
   ----------------------------------------------------------- */
function applyFilter() {
  const elStatus   = document.getElementById("f-status");
  const elPlatform = document.getElementById("f-platform");
  if (!elStatus || !elPlatform) return;
  filter.status   = elStatus.value;
  filter.platform = elPlatform.value;
  const active = filter.status || filter.platform;
  const btnClr = document.getElementById("btn-clr");
  if (btnClr) btnClr.style.display = active ? "inline-flex" : "none";
  ["f-status","f-platform"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "filter-sel" + (el.value ? " active" : "");
  });
  renderContent();
}
function clearFilters() {
  filter = { status: "", platform: "" };
  ["f-status","f-platform"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = "";
    el.className = "filter-sel";
  });
  const btnClr = document.getElementById("btn-clr");
  if (btnClr) btnClr.style.display = "none";
  renderContent();
}
function filtered() {
  return entries.filter(e => {
    if (filter.status   && e.status   !== filter.status)   return false;
    if (filter.platform && e.platform !== filter.platform) return false;
    // Modo cliente: mostra TODAS as peças (cliente vê o calendário completo)
    
    return true;
  }).sort((a,b) => a.date.localeCompare(b.date));
}

/* -----------------------------------------------------------
   9. RENDERIZAÇÃO
   ----------------------------------------------------------- */
function render() {
  entries = currentMonthEntries();
  const ml = document.getElementById("month-label"); if(ml) ml.textContent = `${MONTHS_PT[month]} ${year}`;
  document.getElementById("hdr-client").textContent  = clientName;
  renderStats();
  renderContent();
  populateFilters();
  updateDemandBadge();
}

function renderStats() {
  if (clientMode) { document.getElementById("stats-bar").innerHTML = ""; return; }
  const bar   = document.getElementById("stats-bar");
  const total = entries.length;
  let html = `<div class="stat-total"><strong>${total}</strong> publicação${total !== 1 ? "ões" : ""} planejada${total !== 1 ? "s" : ""}</div><div class="stat-divider"></div>`;
  STATUSES.forEach(s => {
    const n = entries.filter(e => e.status === s).length;
    if (n > 0) {
      const st = STATUS_STYLE[s];
      html += `<div class="stat-item"><div class="stat-dot" style="background:${st.dot}"></div>${s}: <strong style="color:var(--color-text-primary)">${n}</strong></div>`;
    }
  });
  bar.innerHTML = html;
}

function populateFilters() {
  [["f-status", STATUSES], ["f-platform", PLATFORMS]].forEach(([id, opts]) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    const label = sel.options[0].text;
    sel.innerHTML = `<option value="">${label}</option>`;
    opts.forEach(o => { sel.innerHTML += `<option${o === cur ? " selected" : ""}>${o}</option>`; });
    sel.className = "filter-sel" + (cur ? " active" : "");
  });
}

function renderContent() {
  if (view === "grid") renderGrid();
  else renderList();
}

/* -----------------------------------------------------------
   10. GRADE
   ----------------------------------------------------------- */
function renderGrid() {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today          = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate      = today.getDate();

  const dayEntries = {};
  filtered().forEach(e => {
    const d = parseInt(e.date.split("-")[2]);
    if (!dayEntries[d]) dayEntries[d] = [];
    dayEntries[d].push(e);
  });

  let html = `<div class="cal-grid">`;
  DAYS_PT.forEach(d => { html += `<div class="cal-header">${d}</div>`; });

  cells.forEach(day => {
    if (!day) { html += `<div class="cal-cell empty"></div>`; return; }
    const isToday = isCurrentMonth && day === todayDate;
    const de      = dayEntries[day] || [];

    // No modo cliente, célula não abre modal de adicionar
    const cellClick = clientMode ? "" : `onclick="openAdd(${day})"`;
    html += `<div class="cal-cell${clientMode ? " client-cell" : ""}" ${cellClick}>`;
    html += isToday ? `<div class="cal-day today">${day}</div>` : `<div class="cal-day">${day}</div>`;

    de.forEach(e => {
      const st   = STATUS_STYLE[e.status] || STATUS_STYLE.Planejado;
      const icon = PLAT_ICON[e.platform]  || "ti-calendar";
      const clickFn = clientMode ? `openClientApproval('${e.id}')` : `openEdit('${e.id}')`;

      // Define o emoji de status correspondente
      let statusEmoji = "📝";
      const statusLower = (e.status || "").toLowerCase();
      if (statusLower === "publicado") {
        statusEmoji = "✅";
      } else if (statusLower === "agendado") {
        statusEmoji = "📅";
      } else if (statusLower === "aprovação") {
        statusEmoji = "👍🏻";
      } else if (statusLower === "criação") {
        statusEmoji = "🎨";
      } else if (statusLower === "recusado") {
        statusEmoji = "❌";
      } else if (statusLower === "cancelado") {
        statusEmoji = "🚫";
      } else if (statusLower === "pausado") {
        statusEmoji = "⏸️";
      }

      html += `<div class="entry-chip${clientMode ? " client-chip" : ""}" style="background:${st.bg};border:0.5px solid ${st.border};color:${st.text}; display: flex; align-items: center; gap: 4px;" onclick="event.stopPropagation();${clickFn}">
        <i class="ti ${icon}" aria-hidden="true" style="font-size:10px;flex-shrink:0"></i>
        <span style="font-size:11px; flex-shrink:0;">${statusEmoji}</span>
        <span class="chip-text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1;">${e.theme || e.format}</span>
        ${clientMode ? `<i class="ti ti-chevron-right" aria-hidden="true" style="font-size:9px;margin-left:auto;flex-shrink:0"></i>` : ""}
      </div>`;
    });

    html += `</div>`;
  });

  html += `</div>`;

  // Mensagem especial no modo cliente se não houver nada para aprovar
  if (clientMode && filtered().length === 0) {
    document.getElementById("content").innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="ti ti-circle-check" aria-hidden="true" style="font-size:40px;color:var(--color-text-tertiary)"></i></div>
      <div class="empty-title">Nenhuma peça aguardando aprovação</div>
      <div style="font-size:13px">Quando a agência enviar criativos para revisão, eles aparecerão aqui</div>
    </div>`;
    return;
  }

  document.getElementById("content").innerHTML = html;
}

/* -----------------------------------------------------------
   11. LISTA
   ----------------------------------------------------------- */
function renderList() {
  const fe = filtered();
  if (fe.length === 0) {
    const msg = clientMode
      ? "Nenhuma peça aguardando aprovação"
      : "Nenhuma publicação encontrada";
    const sub = clientMode
      ? "Quando a agência enviar criativos para revisão, eles aparecerão aqui"
      : 'Clique em "Adicionar" para começar o planejamento';
    document.getElementById("content").innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="ti ti-calendar" aria-hidden="true" style="font-size:40px;color:var(--color-text-tertiary)"></i></div>
      <div class="empty-title">${msg}</div>
      <div style="font-size:13px">${sub}</div>
    </div>`;
    return;
  }

  const grouped = {};
  fe.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  const formatDate = dateStr => {
    const [y,m,d] = dateStr.split("-").map(Number);
    const dt     = new Date(y, m-1, d);
    const days   = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
    const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${days[dt.getDay()]} , ${d} de ${months[m-1]}`;
  };

  let html = `<div class="list-view">`;
  Object.entries(grouped).forEach(([date, items]) => {
    html += `<div><div class="list-day-label">${formatDate(date)}</div>`;
    items.forEach(e => {
      const st   = STATUS_STYLE[e.status] || STATUS_STYLE.Planejado;
      const icon = PLAT_ICON[e.platform]  || "ti-calendar";
      const clickFn = clientMode ? `openClientApproval('${e.id}')` : `openEdit('${e.id}')`;
      html += `<div class="list-entry${clientMode ? " client-entry" : ""}" onclick="${clickFn}">
        <div class="list-icon"><i class="ti ${icon}" aria-hidden="true" style="color:var(--color-text-secondary)"></i></div>
        <div>
          <div class="list-theme">${e.theme || "(sem tema)"}</div>
          <div class="list-meta">${e.platform} · ${e.format}</div>
        </div>
        <div class="status-pill" style="background:${st.bg};color:${st.text};border:0.5px solid ${st.border}">${e.status}</div>
        ${clientMode ? `<i class="ti ti-chevron-right" aria-hidden="true" style="color:var(--color-text-tertiary)"></i>` : ""}
      </div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  document.getElementById("content").innerHTML = html;
}

/* -----------------------------------------------------------
   12. MODAL DE APROVAÇÃO DO CLIENTE
   ----------------------------------------------------------- */
function openClientApproval(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;

  pendingApprovalFiles = [];

  // Preenche dados da peça
  document.getElementById("ca-theme").textContent    = e.theme || "(sem tema)";
  document.getElementById("ca-platform").textContent = e.platform
