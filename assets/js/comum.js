// NEFE-UEM · funções comuns ao site público e à área de membros
"use strict";
const NEFE = (() => {
  const cfg = window.NEFE_CONFIG || {};
  const configurado = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.SUPABASE_URL || "") &&
    !!cfg.SUPABASE_CHAVE_PUBLICA && !/^COLE-AQUI/.test(cfg.SUPABASE_CHAVE_PUBLICA);
  let sb = null;
  if (configurado && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL.replace(/\/$/, ""), cfg.SUPABASE_CHAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "nefe-sessao" }
    });
  }

  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const MESES_L = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // datas "AAAA-MM-DD" (sem fuso) e carimbos ISO
  const dia = s => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return y && m && d ? new Date(y, m - 1, d) : null; };
  const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const somaDias = (s, n) => { const d = dia(s); if (!d) return null; d.setDate(d.getDate() + n); return d; };
  const fimDoDia = d => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  const fData = d => { d = d instanceof Date ? d : (d ? (String(d).length <= 10 ? dia(d) : new Date(d)) : null); return d && !isNaN(d) ? d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear() : "—"; };
  const fCurta = d => d ? d.getDate() + " " + MESES[d.getMonth()] : "—";
  const fHora = iso => { const d = new Date(iso); return isNaN(d) ? "" : String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const fCarimbo = iso => { const d = new Date(iso); return isNaN(d) ? "" : fCurta(d) + " " + d.getFullYear() + ", " + fHora(iso); };
  const fEvento = iso => { const d = new Date(iso); if (isNaN(d)) return ""; const h = fHora(iso); return DIAS[d.getDay()] + ", " + fData(d) + (h !== "00:00" ? " · " + h : ""); };
  const mt = n => (n === null || n === undefined || n === "") ? "—" : Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " MT";
  const pct = x => Math.round(x * 100) + "%";

  // só endereços http(s) entram em links e imagens
  const urlSegura = u => { if (!u || typeof u !== "string" || !u.trim()) return null; try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };

  // texto simples -> parágrafos, com endereços web clicáveis
  function paragrafos(texto) {
    const blocos = String(texto || "").replace(/\r/g, "").split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    return blocos.map(b => "<p>" + esc(b).replace(/\n/g, "<br>").replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`) + "</p>").join("");
  }

  let avisoT;
  function aviso(msg, tipo) {
    let el = $("#aviso-topo");
    if (!el) { el = document.createElement("div"); el.id = "aviso-topo"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.className = "aviso-topo" + (tipo === "erro" ? " erro" : "");
    el.textContent = msg; el.hidden = false;
    clearTimeout(avisoT); avisoT = setTimeout(() => { el.hidden = true; }, tipo === "erro" ? 7000 : 3000);
  }

  // mensagens de erro da base de dados em português simples
  function mensagemErro(e) {
    const m = (e && (e.message || e.error_description || e.erro)) || "";
    if (/row-level security|violates row-level/i.test(m)) return "Sem permissão para esta acção.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sem ligação à internet. Tente de novo.";
    if (/JWT|expired/i.test(m)) return "A sessão expirou. Entre novamente.";
    if (/Invalid login credentials/i.test(m)) return "Email ou senha incorrectos.";
    if (/Email not confirmed/i.test(m)) return "Conta por confirmar. Fale com a Administração.";
    if (/banned|User is banned/i.test(m)) return "Esta conta está desactivada. Fale com a Administração.";
    if (/duplicate key/i.test(m)) return "Já existe um registo igual.";
    if (/check constraint/i.test(m)) return "Há um valor inválido no formulário.";
    return m || "Ocorreu um erro. Tente de novo.";
  }

  function rodape() {
    const a = $("#ano"); if (a) a.textContent = new Date().getFullYear();
  }

  return { cfg, configurado, sb, MESES, MESES_L, DIAS, esc, $, $$, dia, hoje, somaDias, fimDoDia, fData, fCurta, fHora, fCarimbo, fEvento, mt, pct, urlSegura, paragrafos, aviso, mensagemErro, rodape };
})();
