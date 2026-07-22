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
      if (activeTab === "reports") renderReports();
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
   6. ABAS (CORRIGIDO PARA RECONHECER O RELATÓRIO)
   ----------------------------------------------------------- */
function setTab(tab) {
  activeTab = tab;
  
  document.getElementById("tab-calendar").className = "tab-btn" + (tab === "calendar" ? " on" : "");
  document.getElementById("tab-demands").className  = "tab-btn" + (tab === "demands"  ? " on" : "");
  
  const reportTab = document.getElementById("tab-reports");
  if (reportTab) reportTab.className = "tab-btn" + (tab === "reports" ? " on" : "");

  const adsTab = document.getElementById("tab-ads");
  if (adsTab) adsTab.className = "tab-btn" + (tab === "ads" ? " on" : "");
  
  document.getElementById("section-calendar").style.display = tab === "calendar" ? "" : "none";
  document.getElementById("section-demands").style.display  = tab === "demands"  ? "" : "none";
  
  const reportSec = document.getElementById("section-reports");
  if (reportSec) reportSec.style.display = tab === "reports" ? "" : "none";

  const adsSec = document.getElementById("section-ads");
  if (adsSec) adsSec.style.display = tab === "ads" ? "" : "none";
  
  if (tab === "demands") renderDemands();
  if (tab === "reports") renderReports();
  if (tab === "ads") renderAds();
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
  if (activeTab === "reports") renderReports();
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

    const cellClick = clientMode ? "" : `onclick="openAdd(${day})"`;
    html += `<div class="cal-cell${clientMode ? " client-cell" : ""}" ${cellClick}>`;
    html += isToday ? `<div class="cal-day today">${day}</div>` : `<div class="cal-day">${day}</div>`;

    de.forEach(e => {
      const st   = STATUS_STYLE[e.status] || STATUS_STYLE.Planejado;
      const icon = PLAT_ICON[e.platform]  || "ti-calendar";
      const clickFn = clientMode ? `openClientApproval('${e.id}')` : `openEdit('${e.id}')`;

      let statusEmoji = "📝";
      const statusLower = (e.status || "").toLowerCase();
      if (statusLower === "publicado") {
        statusEmoji = "✅";
      } else if (statusLower === "agendado") {
        statusEmoji = "📅";
      } else if (statusLower === "aprovação") {
        statusEmoji = "✋";
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
    const msg = clientMode ? "Nenhuma peça aguardando aprovação" : "Nenhuma publicação encontrada";
    const sub = clientMode ? "Quando a agência enviar criativos para revisão, eles aparecerão aqui" : 'Clique em "Adicionar" para começar o planejamento';
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
    return `${days[dt.getDay()]}, ${d} de ${months[m-1]}`;
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

  document.getElementById("ca-theme").textContent    = e.theme || "(sem tema)";
  document.getElementById("ca-platform").textContent = e.platform;
  document.getElementById("ca-format").textContent   = e.format;
  document.getElementById("ca-date").textContent     = formatDateSimple(e.date);
  document.getElementById("ca-obs").textContent      = e.observations || "Nenhuma observação.";

  const driveWrap = document.getElementById("ca-drive-wrap");
  if (e.driveLink) {
    driveWrap.style.display = "";
    const a       = document.getElementById("ca-drive-link");
    a.href        = e.driveLink;
    a.textContent = "Abrir criativo no Drive";
  } else {
    driveWrap.style.display = "none";
  }

  const histWrap = document.getElementById("ca-history-wrap");
  if (e.history && e.history.length > 0) {
    histWrap.style.display = "";
    document.getElementById("ca-history-list").innerHTML = e.history.map(h => `
      <div class="history-item">
        <div class="history-meta">
          <span class="history-action history-action--${h.action}">${h.action === "approved" ? "✓ Aprovado" : "✗ Alteração solicitada"}</span>
          <span class="history-date">${fmtDatetime(h.at)}</span>
        </div>
        ${h.comment ? `<div class="history-comment">"${h.comment}"</div>` : ""}
      </div>`).join("");
  } else {
    histWrap.style.display = "none";
  }

  document.getElementById("ca-decision-approved").checked = false;
  document.getElementById("ca-decision-alterar").checked  = false;
  document.getElementById("ca-alterar-wrap").style.display = "none";
  document.getElementById("ca-alterar-text").value         = "";
  document.getElementById("ca-file").value                 = "";
  document.getElementById("ca-file-preview").innerHTML     = "";

  document.getElementById("client-approval-modal").style.display   = "flex";
  document.getElementById("client-approval-modal").dataset.entryId = id;
}

function closeClientApproval() {
  document.getElementById("client-approval-modal").style.display = "none";
  pendingApprovalFiles = [];
}

function onDecisionChange(val) {
  document.getElementById("ca-alterar-wrap").style.display = val === "alterar" ? "" : "none";
}

function handleApprovalFileSelect(input) {
  const preview = document.getElementById("ca-file-preview");
  preview.innerHTML = "";
  pendingApprovalFiles = [];
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(ev) {
      pendingApprovalFiles.push({ name: file.name, size: file.size, type: file.type, data: ev.target.result });
      const isImage = file.type.startsWith("image/");
      const isPDF   = file.type === "application/pdf";
      const icon    = isPDF ? "ti-file-type-pdf" : isImage ? "ti-photo" : "ti-file";
      const chip    = document.createElement("div");
      chip.className = "file-chip";
      chip.innerHTML = `<i class="ti ${icon}" aria-hidden="true"></i><span>${file.name}</span>`;
      if (isImage) {
        const img = document.createElement("img");
        img.src       = ev.target.result;
        img.className = "file-preview-img";
        preview.appendChild(img);
      }
      preview.appendChild(chip);
    };
    reader.readAsDataURL(file);
  });
}

function submitClientApproval() {
  const id = document.getElementById("client-approval-modal").dataset.entryId;
  const e  = allEntries.find(x => x.id === id);
  if (!e) return;

  const approved = document.getElementById("ca-decision-approved").checked;
  const alterar  = document.getElementById("ca-decision-alterar").checked;

  if (!approved && !alterar) {
    alert("Por favor, selecione Aprovado ou Solicitar alteração.");
    return;
  }

  const history = e.history ? [...e.history] : [];
  let status;

  if (alterar) {
    const text = document.getElementById("ca-alterar-text").value.trim();
    if (!text) {
      document.getElementById("ca-alterar-text").focus();
      alert("Descreva a alteração desejada antes de enviar.");
      return;
    }
    history.push({ action: "refused", comment: text, files: pendingApprovalFiles, at: new Date().toISOString() });
    status = "Recusado";
  } else {
    history.push({ action: "approved", comment: "", files: [], at: new Date().toISOString() });
    status = "Agendado";
  }

  db.collection("clients").doc(currentClientId).collection("entries").doc(id)
    .update({ history, status })
    .catch(err => alert("Erro: " + err.message));

  closeClientApproval();
}

/* -----------------------------------------------------------
   13. FORMULÁRIO AGÊNCIA (adicionar/editar publicação)
   ----------------------------------------------------------- */
function buildForm(e) {
  const historyHtml = (e.history && e.history.length > 0)
    ? `<div>
        <label class="form-label">Histórico de aprovações</label>
        <div class="approval-history">
          ${e.history.map(h => `
            <div class="history-item">
              <div class="history-meta">
                <span class="history-action history-action--${h.action}">${h.action === "approved" ? "✓ Aprovado" : "✗ Alteração solicitada"}</span>
                <span class="history-date">${fmtDatetime(h.at)}</span>
              </div>
              ${h.comment ? `<div class="history-comment">"${h.comment}"</div>` : ""}
              ${h.files && h.files.length > 0 ? `<div style="margin-top:6px">${h.files.map(f => {
                const isImage = f.type && f.type.startsWith("image/");
                const icon    = f.type === "application/pdf" ? "ti-file-type-pdf" : isImage ? "ti-photo" : "ti-file";
                return `<div class="file-chip" style="margin-top:4px">
                  <i class="ti ${icon}" aria-hidden="true"></i>
                  <a href="${f.data}" download="${f.name}" style="color:#3b82f6;font-size:12px">${f.name}</a>
                </div>`;
              }).join("")}</div>` : ""}
            </div>`).join("")}
        </div>
      </div>`
    : "";

  return `
    <div>
      <label class="form-label">Tema / descrição <span class="form-req">*</span></label>
      <input id="f-theme" value="${(e.theme||"").replace(/"/g,"&quot;")}" placeholder="Ex: Promoção de verão — produto X">
    </div>
    <div class="form-row">
      <div>
        <label class="form-label">Data <span class="form-req">*</span></label>
        <input type="date" id="f-date" value="${e.date||""}">
      </div>
      <div>
        <label class="form-label">Plataforma</label>
        <select id="f-platform">${PLATFORMS.map(p=>`<option${p===e.platform?" selected":""}>${p}</option>`).join("")}</select>
      </div>
    </div>
    <div>
      <label class="form-label">Formato</label>
      <select id="f-format">${FORMATS.map(f=>`<option${f===e.format?" selected":""}>${f}</option>`).join("")}</select>
    </div>
    <div>
      <label class="form-label">Status</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${STATUSES.map(s=>{
          const st=STATUS_STYLE[s], sel=e.status===s;
          return `<button type="button" onclick="selectStatus(this,'${s}')" data-status="${s}" style="border-radius:99px;padding:4px 12px;font-size:12px;cursor:pointer;border:0.5px solid ${sel?st.border:"var(--color-border-tertiary)"};background:${sel?st.bg:"var(--color-background-primary)"};color:${sel?st.text:"var(--color-text-secondary)"};">${s}</button>`;
        }).join("")}
      </div>
      <input type="hidden" id="f-status" value="${e.status||"Planejado"}">
    </div>
    <div>
      <label class="form-label">Link do criativo no Drive</label>
      <input id="f-drive" value="${(e.driveLink||"").replace(/"/g,"&quot;")}" placeholder="Cole aqui o link do Google Drive com o criativo">
    </div>
    <div>
      <label class="form-label">Observações</label>
      <textarea id="f-obs" rows="2" placeholder="Notas internas, copy, contexto...">${e.observations||""}</textarea>
    </div>
    <div>
      <label class="form-label">Referência / link</label>
      <input id="f-ref" value="${(e.reference||"").replace(/"/g,"&quot;")}" placeholder="Link de referência visual ou conteúdo">
    </div>
    ${historyHtml}`;
}

function selectStatus(btn, s) {
  document.getElementById("f-status").value = s;
  document.querySelectorAll("[data-status]").forEach(b => {
    const bs=b.dataset.status, st=STATUS_STYLE[bs];
    if (bs===s) { b.style.background=st.bg; b.style.color=st.text; b.style.borderColor=st.border; }
    else        { b.style.background="var(--color-background-primary)"; b.style.color="var(--color-text-secondary)"; b.style.borderColor="var(--color-border-tertiary)"; }
  });
}

/* -----------------------------------------------------------
   14. ABRIR/FECHAR MODAIS AGÊNCIA
   ----------------------------------------------------------- */
function openAdd(day) {
  isNewEntry = true;
  const dateStr = day ? `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : "";
  editEntry = { id:uid(), date:dateStr, platform:"Instagram", format:"Feed", theme:"", status:"Planejado", observations:"", reference:"", driveLink:"", history:[] };
  document.getElementById("modal-title").textContent              = "Nova publicação";
  document.getElementById("modal-body").innerHTML                 = buildForm(editEntry);
  document.getElementById("modal-del-wrap").innerHTML              = "";
  document.getElementById("btn-save").textContent                 = "Adicionar";
  document.getElementById("btn-save").disabled                    = false;
  document.getElementById("modal-approval-actions").style.display = "none";
  document.getElementById("modal").style.display                   = "flex";
}

function openEdit(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  isNewEntry = false;
  editEntry  = { ...e };
  document.getElementById("modal-title").textContent  = "Editar publicação";
  document.getElementById("modal-body").innerHTML     = buildForm(e);
  document.getElementById("modal-del-wrap").innerHTML = `<button class="btn-del" onclick="deleteEntry()"><i class="ti ti-trash" aria-hidden="true"></i> Excluir</button>`;
  document.getElementById("btn-save").textContent     = "Salvar";
  document.getElementById("btn-save").disabled        = false;
  const aa = document.getElementById("modal-approval-actions");
  if (e.status === "Aprovação") { aa.style.display="flex"; aa.dataset.entryId=id; }
  else aa.style.display="none";
  document.getElementById("modal").style.display = "flex";
}

function closeModal() { document.getElementById("modal").style.display="none"; editEntry=null; }

function openSettings() {
  document.getElementById("inp-client").value = clientName;
  document.getElementById("settings-modal").style.display = "flex";
}
function closeSettings() { document.getElementById("settings-modal").style.display="none"; }

/* -----------------------------------------------------------
   15. SALVAR / EXCLUIR PUBLICAÇÃO
   ----------------------------------------------------------- */
function saveEntry() {
  const theme = document.getElementById("f-theme").value.trim();
  const date  = document.getElementById("f-date").value;
  if (!theme || !date) return;
  const entry = {
    id:           editEntry.id,
    theme, date,
    platform:     document.getElementById("f-platform").value,
    format:       document.getElementById("f-format").value,
    status:       document.getElementById("f-status").value,
    driveLink:    document.getElementById("f-drive").value.trim(),
    observations: document.getElementById("f-obs").value,
    reference:    document.getElementById("f-ref").value,
    history:      editEntry.history || []
  };
  db.collection("clients").doc(currentClientId).collection("entries").doc(entry.id).set(entry)
    .catch(err => alert("Erro ao salvar: " + err.message));
  closeModal();
}

function deleteEntry() {
  if (!editEntry) return;
  db.collection("clients").doc(currentClientId).collection("entries").doc(editEntry.id).delete()
    .catch(err => alert("Erro ao excluir: " + err.message));
  closeModal();
}

function saveSettings() {
  clientName = document.getElementById("inp-client").value || "Nome do cliente";
  db.collection("clients").doc(currentClientId).set({ name: clientName }, { merge: true })
    .catch(err => alert("Erro ao salvar: " + err.message));
  closeSettings();
}

function inlineApprove() {
  const id  = document.getElementById("modal-approval-actions").dataset.entryId;
  const obs = document.getElementById("f-obs").value.trim();
  const e   = allEntries.find(x => x.id === id);
  if (!e) return;
  const history = e.history ? [...e.history] : [];
  history.push({ action: "approved", comment: obs, at: new Date().toISOString() });
  db.collection("clients").doc(currentClientId).collection("entries").doc(id)
    .update({ history, status: "Agendado" })
    .catch(err => alert("Erro: " + err.message));
  closeModal();
}

function inlineRefuse() {
  const id  = document.getElementById("modal-approval-actions").dataset.entryId;
  const obs = document.getElementById("f-obs").value.trim();
  const e   = allEntries.find(x => x.id === id);
  if (!e) return;
  const history = e.history ? [...e.history] : [];
  history.push({ action: "refused", comment: obs, at: new Date().toISOString() });
  db.collection("clients").doc(currentClientId).collection("entries").doc(id)
    .update({ history, status: "Recusado" })
    .catch(err => alert("Erro: " + err.message));
  closeModal();
}

/* -----------------------------------------------------------
   16. DEMANDAS
   ----------------------------------------------------------- */
const DEMAND_TYPES    = ["Post","Reels","Stories","Carrossel","Vídeo","Banner","E-mail Marketing","Material Impresso","Outro"];
const DEMAND_STATUSES = ["Novo","Produção","Recusado"];
const DEMAND_STATUS_STYLE = {
  "Novo":       {bg:"#f0fdf4",border:"#bbf7d0",text:"#15803d",dot:"#22c55e"},
  "Produção":   {bg:"#eff6ff",border:"#bfdbfe",text:"#1d4ed8",dot:"#3b82f6"},
  "Recusado":   {bg:"#fff1f2",border:"#fecdd3",text:"#be123c",dot:"#f43f5e"}
};

function updateDemandBadge() {
  const n = demands.filter(d => d.status === "Novo").length;
  const b = document.getElementById("demand-badge");
  if (b) {
    if (n > 0) { b.textContent = n; b.style.display = "inline-flex"; }
    else { b.style.display = "none"; }
  }
}

function handleFileSelect(input) {
  const preview = document.getElementById("df-file-preview");
  if (!preview) return;
  preview.innerHTML = ""; 
  pendingFiles = [];
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(ev) {
      pendingFiles.push({name: file.name, size: file.size, type: file.type, data: ev.target.result});
      const isImage = file.type.startsWith("image/"), isPDF = file.type === "application/pdf";
      const icon = isPDF ? "ti-file-type-pdf" : isImage ? "ti-photo" : "ti-file";
      const chip = document.createElement("div"); 
      chip.className = "file-chip";
      chip.innerHTML = `<i class="ti ${icon}" aria-hidden="true"></i><span>${file.name}</span>`;
      if (isImage) {
        const img = document.createElement("img"); 
        img.src = ev.target.result; 
        img.className = "file-preview-img"; 
        preview.appendChild(img);
      }
      preview.appendChild(chip);
    };
    reader.readAsDataURL(file);
  });
}

function openDemandModal() {
  pendingFiles = [];
  ["df-type","df-title","df-description","df-deadline","df-ref","df-file"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === "df-type" ? DEMAND_TYPES[0] : "";
  });
  const preview = document.getElementById("df-file-preview");
  if (preview) preview.innerHTML = "";
  const modal = document.getElementById("demand-form-modal");
  if (modal) modal.style.display = "flex";
}

function closeDemandModal() { 
  const modal = document.getElementById("demand-form-modal");
  if (modal) modal.style.display = "none"; 
  pendingFiles = []; 
}

function deleteDemand() {
  const modal = document.getElementById("demand-detail-modal");
  if (!modal) return;
  const id = modal.dataset.demandId;
  if (!id) return;
  
  if (confirm("Tem certeza que deseja excluir esta demanda definitivamente? Essa ação não pode ser desfeita.")) {
    db.collection("clients").doc(currentClientId).collection("demands").doc(id).delete()
      .then(() => {
        closeDemandDetail();
      })
      .catch(err => alert("Erro ao excluir demanda: " + err.message));
  }
}

function submitDemand() {
  const titleEl = document.getElementById("df-title");
  if (!titleEl) return;
  const title = titleEl.value.trim();
  if (!title) { titleEl.focus(); return; }
  
  const demand = {
    id: uid(), 
    title,
    type:        document.getElementById("df-type").value,
    description: document.getElementById("df-description").value.trim(),
    deadline:    document.getElementById("df-deadline").value,
    reference:   document.getElementById("df-ref").value.trim(),
    files:       pendingFiles,
    status:      "Novo",
    createdAt:   new Date().toISOString(),
    agencyNotes: ""
  };
  db.collection("clients").doc(currentClientId).collection("demands").doc(demand.id).set(demand)
    .catch(err => alert("Erro ao enviar demanda: " + err.message));
  closeDemandModal();
}

function openDemandDetail(id) {
  const d = demands.find(x => x.id === id);
  if (!d) return;
  
  document.getElementById("dd-title").textContent       = d.title;
  document.getElementById("dd-type").textContent        = d.type;
  document.getElementById("dd-created").textContent     = fmtDatetime(d.createdAt);
  document.getElementById("dd-description").textContent = d.description || "Sem descrição.";
  document.getElementById("dd-deadline").textContent    = d.deadline ? formatDateSimple(d.deadline) : "Não informado";
  
  const rw = document.getElementById("dd-ref-wrap"); 
  if (rw) rw.style.display = d.reference ? "" : "none";
  if (d.reference) { 
    const a = document.getElementById("dd-ref-link"); 
    if (a) { a.href = d.reference; a.textContent = d.reference; } 
  }
  
  const fw = document.getElementById("dd-files-wrap");
  if (fw) {
    if (d.files && d.files.length > 0) {
      fw.style.display = "";
      document.getElementById("dd-files-list").innerHTML = d.files.map(f => {
        const isImage = f.type && f.type.startsWith("image/"), isPDF = f.type === "application/pdf";
        const icon = isPDF ? "ti-file-type-pdf" : isImage ? "ti-photo" : "ti-file";
        return `<div class="file-chip-detail">${isImage ? `<img src="${f.data}" class="file-preview-img">` : ""}
          <div style="display:flex;align-items:center;gap:6px;margin-top:${isImage ? "6px" : "0"}">
            <i class="ti ${icon}" aria-hidden="true"></i>
            <a href="${f.data}" download="${f.name}" style="font-size:12px;color:#3b82f6">${f.name}</a>
          </div></div>`;
      }).join("");
    } else { 
      fw.style.display = "none"; 
    }
  }
  
  const notesEl = document.getElementById("dd-agency-notes");
  if (notesEl) notesEl.value = d.agencyNotes || "";
  
  const sel = document.getElementById("dd-status-sel");
  if (sel) {
    sel.innerHTML = DEMAND_STATUSES.map(s => `<option${s === d.status ? " selected" : ""}>${s}</option>`).join("");
  }
  
  const detailModal = document.getElementById("demand-detail-modal");
  if (detailModal) {
    detailModal.style.display = "flex";
    detailModal.dataset.demandId = id;
  }
}

function closeDemandDetail() { 
  const modal = document.getElementById("demand-detail-modal");
  if (modal) modal.style.display = "none"; 
}

function saveDemandDetail() {
  const modal = document.getElementById("demand-detail-modal");
  if (!modal) return;
  const id = modal.dataset.demandId;
  
  const statusEl = document.getElementById("dd-status-sel");
  const notesEl = document.getElementById("dd-agency-notes");
  
  const status      = statusEl ? statusEl.value : "Novo";
  const agencyNotes = notesEl ? notesEl.value.trim() : "";
  
  const originalDemand = demands.find(x => x.id === id);
  const statusAntigo = originalDemand ? originalDemand.status : "";

  db.collection("clients").doc(currentClientId).collection("demands").doc(id)
    .update({ status, agencyNotes })
    .then(() => {
      // 1. Se alterou para "Produção" agora, cria o card no Calendário Editorial nativamente
      if (status === "Produção" && statusAntigo !== "Produção" && originalDemand) {
        const novaPub = {
          id: uid(),
          theme: originalDemand.title,
          date: originalDemand.deadline || new Date().toISOString().split("T")[0],
          platform: "Instagram",
          format: originalDemand.type === "Reels" ? "Reels" : originalDemand.type === "Stories" ? "Stories" : "Feed",
          status: "Criação",
          driveLink: originalDemand.reference || "",
          observations: originalDemand.description || "",
          reference: "",
          history: []
        };
        db.collection("clients").doc(currentClientId).collection("entries").doc(novaPub.id).set(novaPub)
          .catch(err => console.error("Erro ao gerar card no calendário:", err));

        // 2. Envia os dados via Webhook para o Make criar a tarefa no ClickUp
        const webhookUrl = "https://hook.us2.make.com/91micj0xfrnqrd7xs729k1hqyd7fmjn8";
        
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: currentClientId,
            clientName: clientName,
            demandTitle: originalDemand.title,
            demandType: originalDemand.type,
            demandDescription: originalDemand.description || "",
            demandDeadline: originalDemand.deadline || "",
            demandReference: originalDemand.reference || ""
          })
        }).catch(err => console.error("Erro ao enviar webhook para o Make:", err));
      }
    })
    .catch(err => alert("Erro: " + err.message));
    
  closeDemandDetail();
}

function renderDemands() {
  const container = document.getElementById("demands-list");
  if (!container) return;
  
  if (demands.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="ti ti-inbox" aria-hidden="true" style="font-size:40px;color:var(--color-text-tertiary)"></i></div>
      <div class="empty-title">Nenhuma demanda enviada</div>
      <div style="font-size:13px">Clique em "Nova Demanda" para enviar um pedido à agência</div>
    </div>`;
    return;
  }
  container.innerHTML = demands.map(d => {
    const st = DEMAND_STATUS_STYLE[d.status] || DEMAND_STATUS_STYLE["Novo"];
    const fc = d.files && d.files.length > 0 ? `<span class="file-count-badge"><i class="ti ti-paperclip" aria-hidden="true"></i> ${d.files.length} arquivo${d.files.length > 1 ? "s" : ""}</span>` : "";
    return `<div class="demand-card" onclick="openDemandDetail('${d.id}')">
      <div class="demand-card-header">
        <div>
          <div class="demand-card-title">${d.title}</div>
          <div class="demand-card-meta">${d.type} · Enviado em ${fmtDatetime(d.createdAt)} ${fc}</div>
        </div>
        <div class="status-pill" style="background:${st.bg};color:${st.text};border:0.5px solid ${st.border}">${d.status}</div>
      </div>
      ${d.description ? `<div class="demand-card-desc">${d.description}</div>` : ""}
      ${d.agencyNotes ? `<div class="demand-card-notes"><i class="ti ti-message-circle" aria-hidden="true"></i> ${d.agencyNotes}</div>` : ""}
    </div>`;
  }).join("");
}

/* -----------------------------------------------------------
   16b. RENDERIZAÇÃO DO RELATÓRIO MENSAL (DASHBOARD)
   ----------------------------------------------------------- */
function renderReports() {
  const container = document.getElementById("reports-content");
  if (!container) return;

  const totalPosts = entries.length;

  if (totalPosts === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="ti ti-chart-donut" aria-hidden="true" style="font-size:40px;color:var(--color-text-tertiary)"></i></div>
      <div class="empty-title">Sem dados para este mês</div>
      <div style="font-size:13px">Planeje ou publique posts neste mês para gerar o relatório estatístico.</div>
    </div>`;
    return;
  }

  const publicados = entries.filter(e => (e.status || "").toLowerCase() === "publicado").length;
  const agendados = entries.filter(e => (e.status || "").toLowerCase() === "agendado").length;
  const taxaConclusao = totalPosts > 0 ? Math.round(((publicados + agendados) / totalPosts) * 100) : 0;

  const platContagem = {};
  const formContagem = {};

  entries.forEach(e => {
    if (e.platform) platContagem[e.platform] = (platContagem[e.platform] || 0) + 1;
    if (e.format) formContagem[e.format] = (formContagem[e.format] || 0) + 1;
  });

  let html = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div style="background: #1e1e24; border: 1px solid #2d2d35; padding: 20px; border-radius: 8px; color: #fff;">
        <div style="color: #9ca3af; font-size: 12px; font-weight: 500; text-transform: uppercase; margin-bottom: 4px;">Volume Planejado</div>
        <div style="font-size: 28px; font-weight: 700;">${totalPosts} <span style="font-size: 14px; font-weight: 400; color: #9ca3af;">peças</span></div>
      </div>
      <div style="background: #1e1e24; border: 1px solid #2d2d35; padding: 20px; border-radius: 8px; color: #fff;">
        <div style="color: #10b981; font-size: 12px; font-weight: 500; text-transform: uppercase; margin-bottom: 4px;">Entregues / Publicados</div>
        <div style="font-size: 28px; font-weight: 700; color: #10b981;">${publicados} <span style="font-size: 14px; font-weight: 400; color: #a7f3d0;">posts</span></div>
      </div>
      <div style="background: #1e1e24; border: 1px solid #2d2d35; padding: 20px; border-radius: 8px; color: #fff;">
        <div style="color: #3b82f6; font-size: 12px; font-weight: 500; text-transform: uppercase; margin-bottom: 4px;">Agendados / Prontos</div>
        <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">${agendados} <span style="font-size: 14px; font-weight: 400; color: #bfdbfe;">posts</span></div>
      </div>
      <div style="background: #1e1e24; border: 1px solid #2d2d35; padding: 20px; border-radius: 8px; color: #fff;">
        <div style="color: #f59e0b; font-size: 12px; font-weight: 500; text-transform: uppercase; margin-bottom: 4px;">Índice de Conclusão</div>
        <div style="font-size: 28px; font-weight: 700; color: #f59e0b;">${taxaConclusao}%</div>
        <div style="background: #2d2d35; height: 6px; border-radius: 3px; margin-top: 8px; overflow: hidden;">
          <div style="background: #f59e0b; width: ${taxaConclusao}%; height: 100%;"></div>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
      <div style="background: #1e1e24; border: 1px solid #2d2d35; padding: 20px; border-radius: 8px; color: #fff;">
        <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #e5e7eb;">Distribuição por Canal</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${Object.entries(platContagem).map(([plat, qtd]) => {
            const pct = Math.round((qtd / totalPosts) * 100);
            return `
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>${plat}</span>
                  <span style="font-weight: 600;">${qtd} (${pct}%)</span>
                </div>
                <div style="background: #2d2d35; height: 8px; border-radius: 4px; overflow: hidden;">
                  <div style="background: #3b82f6; width: ${pct}%; height: 100%;"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div style="background: #1e1e24; border: 1px solid #2d2d35; padding: 20px; border-radius: 8px; color: #fff;">
        <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #e5e7eb;">Formatos Utilizados</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${Object.entries(formContagem).map(([form, qtd]) => {
            const pct = Math.round((qtd / totalPosts) * 100);
            return `
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>${form}</span>
                  <span style="font-weight: 600;">${qtd} (${pct}%)</span>
                </div>
                <div style="background: #2d2d35; height: 8px; border-radius: 4px; overflow: hidden;">
                  <div style="background: #10b981; width: ${pct}%; height: 100%;"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/* -----------------------------------------------------------
   16c. RENDERIZAÇÃO DE TRÁFEGO PAGO (PLANILHA)
   ----------------------------------------------------------- */
async function renderAds() {
  const container = document.getElementById("ads-content");
  if (!container) return;

  container.innerHTML = `<div style="padding: 20px; color: #9ca3af;">Carregando campanhas do cliente...</div>`;

  const clienteId = (getClientIdFromUrl() || "").trim();

  // Mapeie aqui o link CSV publicado de cada aba específica do cliente:
  const linksPorCliente = {
    "c9069xb6q54btl": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTf9iHSki72lUvYYCQROgxtxtjY60sdD9vbEUtkEsQRp6qFbm3xc0B89o8V3_4IpajTCPfBbRFoGPfn/pub?output=csv",
    "4bv8br4n1nfpui": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTLRzjTIvuIGjrVFdkFKcxvpfO24q42FS1z3-FimaiYo5pOToZxfWSEUvgZ3thsxHJ0Ptiuj82lZOm1/pub?output=csv",
    "tdz3x48jcyq4zy": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQxs5yGuAvqTVGUYSw5HMkzOKVkRHaqpi2xMoVbf-e6i3nP3hVBsKRJsfuAIEGFTwmsWroEoBqgCvBA/pub?output=csv"
    // Adicione os outros clientes aqui no formato: "ID_DO_CLIENTE": "LINK_CSV_DA_ABA"
  };

  const csvUrl = linksPorCliente[clienteId];

  if (!csvUrl) {
    container.innerHTML = `<div style="padding: 20px; color: #9ca3af;">Nenhuma aba de tráfego configurada para este cliente.</div>`;
    return;
  }

  try {
    const response = await fetch(csvUrl);
    const text = await response.text();
    
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length <= 1) {
      container.innerHTML = `<div style="padding: 20px; color: #f43f5e;">A aba deste cliente está vazia.</div>`;
      return;
    }

    // Como cada aba é exclusiva do cliente, todas as linhas de dados aqui pertencem a ele (permite várias campanhas na mesma aba)
    const campanhas = lines.slice(1).map(row => row.split(","));

    container.innerHTML = campanhas.map(c => {
      const limpar = (val) => (val || "").replace(/"/g, "").trim();

      const nomeCampanha   = limpar(c[1]) || "Campanha";
      const resultados     = limpar(c[2]) || "0";
      const custoRes       = limpar(c[3]) + (c[4] ? "," + limpar(c[4]) : "") || "R$ 0,00";
      const impressoes     = limpar(c[5]) || "0";
      const alcance        = limpar(c[6]) || "0";
      const investimento   = limpar(c[7]) + (c[8] ? "," + limpar(c[8]) : "") || "R$ 0,00";
      const cpc            = limpar(c[9]) + (c[10] ? "," + limpar(c[10]) : "") || "R$ 0,00";
      const cpm            = limpar(c[11]) + (c[12] ? "," + limpar(c[12]) : "") || "R$ 0,00";

      return `
        <div style="background: #1e1e24; border: 1px solid #2d2d35; padding: 20px; border-radius: 8px; color: #fff; margin-bottom: 20px;">
          <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #f3f4f6; border-bottom: 1px solid #2d2d35; padding-bottom: 10px;">
            📢 ${nomeCampanha}
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div style="background: #17171c; padding: 14px; border-radius: 6px;">
              <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Investimento</div>
              <div style="font-size: 20px; font-weight: 700; color: #fff;">${investimento}</div>
            </div>
            <div style="background: #17171c; padding: 14px; border-radius: 6px;">
              <div style="color: #10b981; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Resultados</div>
              <div style="font-size: 20px; font-weight: 700; color: #10b981;">${resultados}</div>
            </div>
            <div style="background: #17171c; padding: 14px; border-radius: 6px;">
              <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Custo por Resultado</div>
              <div style="font-size: 20px; font-weight: 700; color: #fff;">${custoRes}</div>
            </div>
            <div style="background: #17171c; padding: 14px; border-radius: 6px;">
              <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Impressões</div>
              <div style="font-size: 20px; font-weight: 700; color: #fff;">${impressoes}</div>
            </div>
            <div style="background: #17171c; padding: 14px; border-radius: 6px;">
              <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Alcance</div>
              <div style="font-size: 20px; font-weight: 700; color: #fff;">${alcance}</div>
            </div>
            <div style="background: #17171c; padding: 14px; border-radius: 6px;">
              <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">CPC</div>
              <div style="font-size: 20px; font-weight: 700; color: #fff;">${cpc}</div>
            </div>
            <div style="background: #17171c; padding: 14px; border-radius: 6px;">
              <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">CPM</div>
              <div style="font-size: 20px; font-weight: 700; color: #fff;">${cpm}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("Erro ao carregar tráfego pago:", error);
    container.innerHTML = `<div style="padding: 20px; color: #f43f5e;">Erro ao processar os dados da planilha.</div>`;
  }
}
/* -----------------------------------------------------------
   17. INICIALIZAÇÃO
   ----------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", load);

function toggleClientMode() {}
