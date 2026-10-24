// NEFE-UEM · Área de membros (login obrigatório)
// A segurança está na base de dados (regras RLS e gatilhos em supabase/01-estrutura.sql).
// Esta página só mostra os botões que fazem sentido para o cargo de cada pessoa.
"use strict";
(() => {
  const { esc, $, $$, dia, hoje, somaDias, fimDoDia, fData, fCurta, fCarimbo, fEvento, mt, pct, urlSegura, paragrafos, aviso, mensagemErro, MESES, MESES_L } = NEFE;
  const sb = NEFE.sb || (window.NEFE_DEMO && window.NEFE_DEMO.cliente());
  if (!sb) { location.replace("entrar.html"); return; }

  // ------------------------------------------------------------------
  // Referência (Manual de Procedimentos)
  // ------------------------------------------------------------------
  const FASES = [
    { n: 1, nome: "Planeamento", p: -30, k: "D−30", ref: "§4.1" },
    { n: 2, nome: "Aprovação", p: -21, k: "D−21", ref: "§4.2" },
    { n: 3, nome: "Preparação e aquisição", p: -8, k: "D−8", ref: "§4.3" },
    { n: 4, nome: "Ponto de situação", p: -7, k: "D−7", ref: "§4.4" },
    { n: 5, nome: "Execução", p: 0, k: "Dia D", ref: "§4.5" },
    { n: 6, nome: "Encerramento", p: 7, k: "D+7", ref: "§4.6" },
    { n: 7, nome: "Auditoria", p: 15, k: "D+15", ref: "§4.7" }
  ];
  const TIPOS = {
    palestra: { n: "Palestra, masterclass, mesa redonda ou debate", ref: "§6.1", c: "Água e lanches comprados não excedem os presentes + 10%; um certificado por orador efectivamente presente." },
    workshop: { n: "Workshop com certificação", ref: "§6.2", c: "Certificados emitidos = participantes elegíveis na lista de presenças; conferir as 31 cartolinas e 31 impressões a cores." },
    concurso: { n: "Olimpíadas ou concurso", ref: "§6.3", c: "Acta e grelhas coincidem com os vencedores anunciados; prémios entregues = prémios adquiridos ou doados." },
    programa: { n: "Programa contínuo", ref: "§6.4", c: "Propinas cobradas = inscritos × valor da tabela − isenções aprovadas por escrito." },
    bilheteira: { n: "Evento com bilheteira ou bancas", ref: "§6.5", c: "Receita depositada = bilhetes vendidos × preço + taxas das bancas; sequência de bilhetes completa." },
    solidaria: { n: "Acção solidária ou de saúde", ref: "§6.6", c: "Total angariado = total entregue + despesas autorizadas; nenhum fundo solidário usado noutras actividades." },
    visita: { n: "Visita institucional ou intercâmbio", ref: "§6.7", c: "Lugares pagos no transporte = participantes efectivos, com margem máxima de 5%." },
    comunicacao: { n: "Comunicação ou auscultação", ref: "§6.8", c: "" },
    aquisicao: { n: "Aquisição interna", ref: "§6.9", c: "Bens entregues coincidem com a lista nominal aprovada." },
    outra: { n: "Outra actividade", ref: "§1.3", c: "" }
  };
  const CARGOS = { presidente: "Presidente", vice: "Vice-Presidente", auditor: "Auditor Interno", chefe: "Chefe de departamento", membro: "Membro de departamento" };
  const PAPEL = { dep: "Departamento responsável", pres: "Presidente", vp: "Vice-Presidente", cf: "Conselho Fiscal" };
  const OPINIOES = { sem_reservas: { l: "Sem reservas", c: "ok" }, com_reservas: { l: "Com reservas", c: "atraso" }, desfavoravel: { l: "Desfavorável", c: "erro" } };
  const CAT = { noticia: "Notícia", evento: "Evento", oportunidade: "Oportunidade", jornal: "Jornal da Semana", comunicado: "Comunicado" };
  const EST_PUB = { rascunho: "Rascunho", submetida: "Para aprovação", publicada: "Publicada", arquivada: "Arquivada" };
  const DEPTS_OPERATIVOS = ["sg", "tes", "uga", "log", "com", "emp", "acad", "incl"];

  // ------------------------------------------------------------------
  // Estado
  // ------------------------------------------------------------------
  const S = {
    eu: null, perfis: new Map(), depts: new Map(), passos: [], acts: new Map(), chk: new Map(),
    recentes: [], cfg: {}, pubs: null, ficha: { id: null, hist: [], tarefas: [] }, pronto: false
  };
  let filtros = { q: "", dept: "", estado: "", sem: "" };
  try { Object.assign(filtros, JSON.parse(localStorage.getItem("nefe.filtros") || "{}")); } catch (e) { }
  const guardaFiltros = () => { try { localStorage.setItem("nefe.filtros", JSON.stringify(filtros)); } catch (e) { } };

  // ------------------------------------------------------------------
  // Quem sou e o que posso fazer
  // ------------------------------------------------------------------
  const eu = () => S.eu || {};
  const cargo = () => eu().cargo;
  const meuDept = () => eu().departamento;
  const ePres = () => cargo() === "presidente";
  const eVice = () => cargo() === "vice";
  const eAud = () => cargo() === "auditor";
  const eAdmin = () => ["presidente", "vice", "auditor"].includes(cargo());
  const eDireccao = () => ["presidente", "vice"].includes(cargo());
  const eChefe = () => cargo() === "chefe";
  const eCom = () => ["chefe", "membro"].includes(cargo()) && meuDept() === "com";
  const principal = a => eChefe() && meuDept() === a.departamento;
  const doDept = a => ["chefe", "membro"].includes(cargo()) && meuDept() === a.departamento;
  const aberta = a => (a.estado || "activa") === "activa";
  const viva = a => ["activa", "concluida"].includes(a.estado);

  const podeCriar = () => eChefe() || eDireccao();
  const podeEditar = a => aberta(a) && (principal(a) || eDireccao());
  const podeConcluir = a => aberta(a) && (principal(a) || ePres());
  const podeCancelar = a => ["activa", "adiada"].includes(a.estado) && (principal(a) || ePres());
  const podeAdiar = a => aberta(a) && (principal(a) || eDireccao());
  const podeValores = a => viva(a) && (principal(a) || eDireccao() || (eChefe() && meuDept() === "tes"));
  const podeAgenda = a => viva(a) && (principal(a) || eDireccao());
  const podeTarefas = a => viva(a) && (doDept(a) || ePres());
  const podePublicacoes = () => eCom() || eDireccao();
  const exigeAprovacao = () => S.cfg.publicacoes_exigem_aprovacao !== false;

  // ------------------------------------------------------------------
  // Regras do ciclo de vida (espelham as funções da base de dados)
  // ------------------------------------------------------------------
  const semestreActual = () => S.cfg.semestre_actual || "II-2026";
  const envolve = (a, cod) => a.departamento === cod || (a.departamentos_envolvidos || []).includes(cod);
  const papelOk = (a, p) => ["dep", "pres", "vp", "cf"].includes(p.papel) || envolve(a, p.papel);
  const condOk = (a, p) => !p.condicao || (p.condicao === "estrutural" && a.estrutural) || (p.condicao === "receitas" && a.tem_receitas);
  const obrigatorio = (a, p) => p.tipo == null && condOk(a, p) && papelOk(a, p);
  const visivel = (a, p) => (p.tipo == null || p.tipo === a.tipo) && (condOk(a, p) || p.opcional) && papelOk(a, p);
  const registo = (a, k) => { const m = S.chk.get(a.id); return m ? m.get(k) : null; };
  const feito = (a, k) => { const r = registo(a, k); return !!(r && r.feito); };
  const passosFase = (a, n) => S.passos.filter(p => p.tipo == null && p.fase === n && visivel(a, p)).sort((x, y) => x.ordem - y.ordem);
  const passosTipo = a => S.passos.filter(p => p.tipo === a.tipo && visivel(a, p)).sort((x, y) => x.ordem - y.ordem);
  function faseDe(a) { for (const f of FASES) if (S.passos.some(p => p.tipo == null && p.fase === f.n && obrigatorio(a, p) && !feito(a, p.chave))) return f.n; return 8; }
  function progresso(a) {
    if (a.estado === "concluida") return feito(a, "f7_par") ? 1 : progressoBruto(a);
    return progressoBruto(a);
  }
  function progressoBruto(a) { let t = 0, d = 0; S.passos.forEach(p => { if (obrigatorio(a, p)) { t++; if (feito(a, p.chave)) d++; } }); return t ? d / t : 0; }
  const prazoFase = (a, n) => a.data ? somaDias(a.data, FASES[n - 1].p) : null;
  const emFalta = a => S.passos.filter(p => p.tipo == null && p.fase >= 1 && p.fase <= 6 && obrigatorio(a, p) && !feito(a, p.chave));

  function situacao(a) {
    const e = a.estado;
    if (e === "nao_realizada") return { c: "cinza", l: "Não realizada" };
    if (e === "cancelada") return { c: "erro", l: "Cancelada" };
    if (e === "adiada") return { c: "atraso", l: "Adiada" };
    if (e === "concluida") {
      if (feito(a, "f7_par") || a.parecer) return { c: "verde", l: "Auditada" };
      const lim = a.data ? somaDias(a.data, 15) : null; const atraso = !!(lim && fimDoDia(lim) < new Date());
      return { c: atraso ? "atraso" : "verde", l: atraso ? "Parecer em atraso" : "Aguarda parecer", atraso };
    }
    const f = faseDe(a);
    if (f >= 7) return { c: "verde", l: "Pronta a concluir", f: 7 };
    const fase = FASES[f - 1]; let atraso = false, txt = "";
    if (a.data) { const lim = prazoFase(a, f); if (fimDoDia(lim) < new Date()) { atraso = true; txt = "Prazo da fase " + f + " venceu a " + fCurta(lim); } }
    return { c: atraso ? "atraso" : "info", l: "Fase " + f + " · " + fase.nome, atraso, txt, f };
  }
  function podeMarcar(a, p) {
    if (!viva(a) || p.chave === "f7_par" || !visivel(a, p)) return false;
    const c = cargo(), d = meuDept();
    if (p.papel === "dep") return (["chefe", "membro"].includes(c) && d === a.departamento) || c === "presidente";
    if (p.papel === "pres") return c === "presidente";
    if (p.papel === "vp") return c === "vice";
    if (p.papel === "cf") return c === "auditor";
    return ["chefe", "membro"].includes(c) && d === p.papel;
  }
  function bloqueadas(cod) {
    return [...S.acts.values()].filter(a => a.departamento === cod && viva(a) && a.data && fimDoDia(somaDias(a.data, 7)) < new Date() && !feito(a, "f6_rel"));
  }
  const nomeDept = c => c ? (S.depts.get(c) ? S.depts.get(c).nome : c) : "Por atribuir";
  const curtoDept = c => c ? (S.depts.get(c) ? S.depts.get(c).nome_curto : c) : "Por atribuir";
  const nome = id => id ? ((S.perfis.get(id) || {}).nome || "Membro") : "Sistema";
  const papelNome = (a, p) => p.papel === "dep" ? curtoDept(a.departamento) : (PAPEL[p.papel] || curtoDept(p.papel));
  const processo = a => a.numero ? String(a.numero).padStart(3, "0") + "/" + (a.semestre || "") : null;
  const quando = a => a.data ? fData(a.data) : (a.mes ? MESES_L[a.mes - 1] : "Sem data");
  const ordem = a => a.data ? dia(a.data).getTime() : (a.mes ? new Date(2026, a.mes - 1, 28).getTime() : 9e15);

  // Indicadores de auditoria (§7)
  function indicadores(a) {
    const t = k => { const r = registo(a, k); return r && r.feito ? new Date(r.em) : null; };
    const agora = new Date(), out = [];
    const ap = t("f2_aprov"), pg = t("f3_pag");
    out.push({ n: "Aprovação prévia", ok: ap ? (pg ? ap <= pg : true) : (pg ? false : null), d: ap ? "Aprovada a " + fCurta(ap) : (pg ? "Pagamento sem aprovação registada" : "Ainda sem aprovação") });
    if (a.data) { const ps = t("f4_ps"), lim = fimDoDia(somaDias(a.data, -7)); out.push({ n: "Ponto de situação no prazo", ok: ps ? ps <= lim : (agora > lim ? false : null), d: ps ? "Entregue a " + fCurta(ps) : "Prazo " + fCurta(lim) }); }
    if (+a.orcamento > 0 && a.despesa != null) { const x = a.despesa / a.orcamento; out.push({ n: "Execução orçamental (90–110%)", ok: x >= .9 && x <= 1.1, d: pct(x) + " do orçamento" }); }
    else out.push({ n: "Execução orçamental (90–110%)", ok: null, d: "Orçamento ou despesa real por registar" });
    if (a.tem_receitas && a.data) { const dp = t("f6_dep"), lim = fimDoDia(somaDias(a.data, 2)); out.push({ n: "Depósito em 48 horas", ok: dp ? dp <= lim : (agora > lim ? false : null), d: dp ? "Depositado a " + fCurta(dp) : "Prazo " + fCurta(lim) }); }
    if (a.data) { const rl = t("f6_rel"), lim = fimDoDia(somaDias(a.data, 7)); out.push({ n: "Prestação de contas até 7 dias", ok: rl ? rl <= lim : (agora > lim ? false : null), d: rl ? "Entregue a " + fCurta(rl) : "Prazo " + fCurta(lim) }); }
    if (a.autossustentavel) out.push(a.receita_real != null && a.despesa != null ? { n: "Autossustentabilidade", ok: +a.receita_real >= +a.despesa, d: mt(a.receita_real) + " de receita para " + mt(a.despesa) } : { n: "Autossustentabilidade", ok: null, d: "Receita ou despesa real por registar" });
    return out;
  }
  function alertas() {
    const out = [], agora = new Date();
    for (const a of S.acts.values()) {
      if (a.semestre !== semestreActual()) continue;
      if (a.estado === "concluida" && a.forcada) out.push({ s: "alta", a, t: "Concluída com passos em falta", d: a.forcada.motivo });
      if (+a.orcamento > 0 && +a.despesa > 1.1 * a.orcamento) out.push({ s: "alta", a, t: "Despesa acima de 110% do orçamento", d: mt(a.despesa) + " para " + mt(a.orcamento) });
      if (+a.despesa > 0 && !feito(a, "f2_aprov")) out.push({ s: "alta", a, t: "Despesa registada sem aprovação do Presidente", d: "Nenhuma despesa antes da fase 2 (§4)." });
      if (viva(a) && a.tem_receitas && a.data && fimDoDia(somaDias(a.data, 2)) < agora && !feito(a, "f6_dep")) out.push({ s: "alta", a, t: "Receitas não depositadas em 48 horas", d: "Actividade de " + fData(a.data) });
      if (viva(a) && a.data && fimDoDia(somaDias(a.data, 7)) < agora && !feito(a, "f6_rel")) out.push({ s: "média", a, t: "Relatório em atraso: departamento bloqueado (§4.7)", d: nomeDept(a.departamento) });
      if (a.autossustentavel && a.receita_real != null && a.despesa != null && +a.receita_real < +a.despesa) out.push({ s: "média", a, t: "Evento autossustentável com prejuízo", d: mt(a.receita_real - a.despesa) });
      if (aberta(a) && !a.departamento) out.push({ s: "baixa", a, t: "Sem departamento responsável", d: "Atribuir no Plano (§3)." });
      if (aberta(a) && !a.data) out.push({ s: "baixa", a, t: "Sem data definida", d: "Os prazos das fases não podem ser controlados." });
    }
    const o = { alta: 0, "média": 1, baixa: 2 };
    return out.sort((x, y) => o[x.s] - o[y.s]);
  }

  // ------------------------------------------------------------------
  // Acesso aos dados
  // ------------------------------------------------------------------
  async function q(p) { const r = await p; if (r.error) throw r.error; return r.data; }

  async function carregarBase() {
    const { data: ses } = await sb.auth.getSession();
    if (!ses || !ses.session) { location.replace("entrar.html"); return false; }
    const uid = ses.session.user.id;
    const perfil = await q(sb.from("perfis").select("*").eq("id", uid).maybeSingle());
    if (!perfil || !perfil.activo) { await sb.auth.signOut(); location.replace("entrar.html?m=inactivo"); return false; }
    S.eu = perfil;
    const [perfis, depts, passos, cfg] = await Promise.all([
      q(sb.from("perfis").select("id,nome,email,cargo,departamento,activo,trocar_senha,criado_em").order("nome")),
      q(sb.from("departamentos").select("*").order("ordem")),
      q(sb.from("passos").select("*")),
      q(sb.from("configuracoes").select("chave,valor"))
    ]);
    S.perfis = new Map(perfis.map(p => [p.id, p]));
    S.depts = new Map(depts.map(d => [d.codigo, d]));
    S.passos = passos;
    S.cfg = {}; cfg.forEach(r => { S.cfg[r.chave] = r.valor; });
    if (!filtros.sem) filtros.sem = semestreActual();
    await carregarActividades();
    return true;
  }
  async function carregarActividades() {
    const [acts, chk, rec] = await Promise.all([
      q(sb.from("actividades").select("*").order("data", { ascending: true }).limit(2000)),
      q(sb.from("checklist").select("*").limit(20000)),
      q(sb.from("historico").select("*").order("em", { ascending: false }).limit(25))
    ]);
    S.acts = new Map(acts.map(a => [a.id, a]));
    S.chk = new Map();
    chk.forEach(r => { if (!S.chk.has(r.actividade_id)) S.chk.set(r.actividade_id, new Map()); S.chk.get(r.actividade_id).set(r.chave, r); });
    S.recentes = rec;
  }
  async function carregarFicha(id) {
    const [hist, tarefas] = await Promise.all([
      q(sb.from("historico").select("*").eq("actividade_id", id).order("em", { ascending: false }).limit(150)),
      q(sb.from("tarefas").select("*").eq("actividade_id", id).order("criado_em", { ascending: true }))
    ]);
    S.ficha = { id, hist, tarefas };
  }
  async function carregarPublicacoes() {
    S.pubs = await q(sb.from("publicacoes").select("*").order("criado_em", { ascending: false }).limit(300));
  }
  // escrita: devolve true/false e mostra o erro em português
  async function escrever(fn, msgOk, depois) {
    try {
      const r = await fn();
      if (r && r.error) throw r.error;
      if (r && Array.isArray(r.data) && r.data.length === 0 && r.verificar) throw new Error("Sem permissão para esta acção.");
      if (depois !== false) await carregarActividades();
      if (S.ficha.id && depois !== false) await carregarFicha(S.ficha.id).catch(() => { });
      if (msgOk) aviso(msgOk);
      desenhar();
      return true;
    } catch (e) { aviso(mensagemErro(e), "erro"); return false; }
  }
  // update que confirma que alguma linha foi alterada (as regras podem esconder a linha)
  async function actualizar(tabela, id, valores) {
    const r = await sb.from(tabela).update(valores).eq("id", id).select("id");
    if (!r.error && (!r.data || !r.data.length)) return { error: { message: "Sem permissão para esta acção." } };
    return r;
  }

  // ------------------------------------------------------------------
  // Janela (formulários)
  // ------------------------------------------------------------------
  let aoSubmeter = null;
  function abrirJanela(html, fn) {
    $("#janela-corpo").innerHTML = html; $("#janela").hidden = false; aoSubmeter = fn;
    const f = $("#janela-corpo input:not([type=hidden]):not([disabled]), #janela-corpo textarea, #janela-corpo select"); if (f) f.focus();
  }
  function fecharJanela() { $("#janela").hidden = true; $("#janela-corpo").innerHTML = ""; aoSubmeter = null; }
  $("#janela").addEventListener("click", e => { if (e.target.id === "janela" || e.target.closest("[data-fechar]")) fecharJanela(); });
  $("#janela").addEventListener("submit", async e => {
    e.preventDefault(); if (!aoSubmeter) return;
    const form = e.target, botoes = $$("button[type=submit]", form);
    botoes.forEach(b => b.disabled = true);
    const quem = e.submitter ? e.submitter.value : "";
    const ok = await aoSubmeter(new FormData(form), form, quem);
    if (ok !== false) fecharJanela(); else botoes.forEach(b => b.disabled = false);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#janela").hidden) fecharJanela(); });
  const rodapeJanela = (txt, cls = "btn-pri") => `<div class="rodape-form"><button type="button" class="btn" data-fechar>Voltar</button><button type="submit" class="btn ${cls}">${txt}</button></div>`;

  // ------------------------------------------------------------------
  // Cabeçalho e menu
  // ------------------------------------------------------------------
  function desenharCabecalho(rota) {
    const e = eu();
    $("#utilizador").innerHTML = `<b>${esc(e.nome || "")}</b><span>${esc(e.cargo === "chefe" || e.cargo === "membro" ? (e.cargo === "chefe" ? "Chefe · " : "Membro · ") + curtoDept(e.departamento) : CARGOS[e.cargo] || "")}</span>`;
    const pend = minhasPendencias().length;
    const paraAprovar = eDireccao() && S.pubs ? S.pubs.filter(p => p.estado === "submetida").length : 0;
    const itens = [["", "Painel", pend], ["actividades", "Actividades", 0]];
    let html = itens.map(([r, l, c]) => `<a href="#/${r}" aria-current="${rota === r ? "page" : "false"}">${l}${c ? `<span class="contador">${c}</span>` : ""}</a>`).join("");
    if (eAdmin()) html += `<button type="button" class="menu-btn" id="btn-dep" aria-expanded="${!$("#painel-dep").hidden}" aria-controls="painel-dep" ${rota === "d" ? 'style="border-bottom:3px solid #fff"' : ""}>Departamentos ▾</button>`;
    else if (meuDept()) html += `<a href="#/d/${esc(meuDept())}" aria-current="${rota === "d" ? "page" : "false"}">${esc(curtoDept(meuDept()))}</a>`;
    if (podePublicacoes()) html += `<a href="#/publicacoes" aria-current="${rota === "publicacoes" ? "page" : "false"}">Publicações${paraAprovar ? `<span class="contador">${paraAprovar}</span>` : ""}</a>`;
    if (eAdmin()) html += `<a href="#/auditoria" aria-current="${rota === "auditoria" ? "page" : "false"}">Auditoria</a><a href="#/admin" aria-current="${rota === "admin" ? "page" : "false"}">Administração</a>`;
    $("#menu").innerHTML = html;
    if (eAdmin()) {
      $("#lista-dep").innerHTML = [...S.depts.values()].map(d => `<a href="#/d/${esc(d.codigo)}">${esc(d.nome)}<small>${[...S.acts.values()].filter(a => a.departamento === d.codigo && a.semestre === semestreActual()).length} actividades no semestre</small></a>`).join("");
      $("#btn-dep").onclick = () => { $("#painel-dep").hidden = !$("#painel-dep").hidden; $("#btn-dep").setAttribute("aria-expanded", String(!$("#painel-dep").hidden)); };
    }
  }

  // ------------------------------------------------------------------
  // Peças comuns
  // ------------------------------------------------------------------
  const rotSit = s => `<span class="rot rot-${{ info: "info", atraso: "atraso", verde: "verde", erro: "erro", cinza: "cinza" }[s.c]}">${esc(s.l)}</span>`;
  function fasesMini(a) {
    const f = a.estado === "concluida" ? (feito(a, "f7_par") ? 8 : 7) : faseDe(a); const s = situacao(a);
    return `<span class="fases" aria-label="Fase ${Math.min(f, 7)} de 7">${FASES.map(x => `<i class="${x.n < f ? "f" : (x.n === f ? (s.atraso ? "a" : "c") : "")}"></i>`).join("")}</span>`;
  }
  function linhaActividade(a) {
    const s = situacao(a);
    const cls = { info: "", atraso: "s-atraso", verde: "s-verde", erro: "s-erro", cinza: "s-cinza" }[s.c];
    const env = (a.departamentos_envolvidos || []).filter(c => !["tes", "sg"].includes(c));
    return `<a class="linha-act ${cls}" href="#/a/${a.id}"><span class="faixa"></span><div><h3>${esc(a.titulo)}</h3><div class="meta"><span>${esc(curtoDept(a.departamento))}</span><span>${esc(quando(a))}</span>${processo(a) ? `<span>Proc. ${esc(processo(a))}</span>` : ""}<span class="etiqueta">${esc((TIPOS[a.tipo] || TIPOS.outra).n)}</span>${env.length ? `<span class="etiqueta">Com ${esc(env.map(curtoDept).join(", "))}</span>` : ""}${a.grupo ? `<span class="etiqueta">${esc(a.grupo)}</span>` : ""}</div></div><div class="dir">${rotSit(s)}${viva(a) ? `<span style="display:flex;gap:8px;align-items:center">${fasesMini(a)}<span class="num nota-pe">${pct(progresso(a))}</span></span>` : ""}</div></a>`;
  }
  function listaPorMes(L) {
    if (!L.length) return "";
    let h = `<div class="lista-act">`, mes = null;
    for (const a of L) { const m = a.data ? dia(a.data).getMonth() : (a.mes ? a.mes - 1 : -1); if (m !== mes) { mes = m; h += `<div class="mes">${m >= 0 ? MESES_L[m] : "Sem data definida"}</div>`; } h += linhaActividade(a); }
    return h + `</div>`;
  }
  function minhasPendencias() {
    const out = [];
    for (const a of S.acts.values()) {
      if (a.semestre !== semestreActual() || !viva(a)) continue;
      const faseActual = a.estado === "activa" ? faseDe(a) : 7;
      for (const p of S.passos) {
        if (p.tipo != null || !obrigatorio(a, p) || feito(a, p.chave) || p.chave === "f7_par") continue;
        if (p.fase > faseActual) continue;   // só passos da fase em curso ou atrasados
        if (!podeMarcar(a, p)) continue;
        if (p.papel === "dep" && ePres() && a.departamento !== meuDept()) continue;
        out.push({ a, p, lim: prazoFase(a, p.fase) });
      }
      if (eAud() && a.estado === "concluida" && !a.parecer) out.push({ a, p: { texto: "Emitir parecer escrito", fase: 7 }, lim: a.data ? somaDias(a.data, 15) : null });
    }
    return out.sort((x, y) => (x.lim ? x.lim.getTime() : 9e15) - (y.lim ? y.lim.getTime() : 9e15));
  }
  function movimento(r) {
    const act = r.actividade_id && S.acts.get(r.actividade_id);
    return `<div class="mov"><span><b>${esc(nome(r.por))}</b> ${r.tipo === "nota" ? "escreveu uma nota" : esc(r.texto)}${act ? ` · <a href="#/a/${act.id}">${esc(act.titulo)}</a>` : (r.titulo && !act ? ` · ${esc(r.titulo)}` : "")}${r.tipo === "nota" ? `<span class="nota">${esc(r.texto)}</span>` : ""}</span><small>${esc(fCarimbo(r.em))}</small></div>`;
  }
  function kpis(L) {
    const conc = L.filter(a => a.estado === "concluida").length;
    const curso = L.filter(aberta).length, atraso = L.filter(a => situacao(a).atraso).length;
    const parecer = L.filter(a => a.estado === "concluida" && !a.parecer).length;
    const ex = L.length ? conc / L.length : 0;
    return `<div class="kpis"><div class="kpi"><div class="rotulo">Execução do plano</div><div class="valor">${pct(ex)} <small>${conc} de ${L.length}</small></div><div class="barra-prog"><i style="width:${Math.min(100, ex * 100)}%"></i><span class="meta" style="left:80%"></span></div><div class="ajuda">Meta: pelo menos 80% (§7)</div></div>
      <div class="kpi"><div class="rotulo">Em curso</div><div class="valor">${curso}</div><div class="ajuda">actividades activas</div></div>
      <div class="kpi ${atraso ? "alerta" : ""}"><div class="rotulo">Fora do prazo</div><div class="valor">${atraso}</div><div class="ajuda">fase actual com prazo vencido</div></div>
      <div class="kpi"><div class="rotulo">Aguardam parecer</div><div class="valor">${parecer}</div><div class="ajuda">concluídas, parecer até D+15</div></div></div>`;
  }

  // ------------------------------------------------------------------
  // Páginas
  // ------------------------------------------------------------------
  function pgPainel() {
    const L = [...S.acts.values()].filter(a => a.semestre === semestreActual());
    const titulo = eAdmin() ? "Painel do NEFE" : "Painel · " + nomeDept(meuDept());
    let h = `<div class="cabeca-pagina"><div><h1>${esc(titulo)}</h1><p>${esc(semestreActual().replace("-", " Semestre de ").replace(/^I /, "I ").replace(/^II /, "II "))} · ${eAdmin() ? "todas as actividades do Núcleo" : "actividades do seu departamento e as que partilha com outros"}</p></div>${podeCriar() ? `<div class="accoes"><a class="btn btn-pri" href="#/nova">Nova actividade</a></div>` : ""}</div>`;
    if (eu().trocar_senha) h += `<div class="caixa-info atraso" style="margin-bottom:20px"><p><b>Defina a sua senha pessoal.</b> Está a usar a senha temporária dada pela Administração.</p><a class="btn btn-pri" href="#/conta">Mudar senha</a></div>`;
    if (meuDept() && !eAdmin() && bloqueadas(meuDept()).length) h += `<div class="caixa-info atraso" style="margin-bottom:20px"><p><b>Departamento bloqueado (§4.7).</b> Há relatório de actividade em atraso; não pode abrir actividades novas sem autorização do Presidente.</p></div>`;
    h += kpis(L);
    const P = minhasPendencias();
    h += `<div class="grelha g-2-1" style="margin-top:28px"><div>`;
    h += `<section class="sec"><h2 class="titulo-seccao">As minhas pendências <span class="nota-pe" style="text-transform:none;letter-spacing:0;font-weight:400">${P.length} passo${P.length === 1 ? "" : "s"}</span></h2>${P.length ? P.slice(0, 14).map(x => { const v = x.lim && fimDoDia(x.lim) < new Date(); return `<a class="pend" href="#/a/${x.a.id}"><b>${esc(x.p.texto)}</b><small>${esc(x.a.titulo)} · Fase ${x.p.fase}</small><span class="prazo ${v ? "vencido" : ""}">${x.lim ? (v ? "Venceu " : "Até ") + fCurta(x.lim) : "Sem data"}</span></a>`; }).join("") + (P.length > 14 ? `<p class="nota-pe">E mais ${P.length - 14}.</p>` : "") : `<div class="vazio">Não tem passos pendentes.</div>`}</section>`;
    if (eAdmin()) {
      const ds = [...S.depts.values()].filter(d => L.some(a => a.departamento === d.codigo));
      const semDept = L.filter(a => !a.departamento).length;
      h += `<section class="sec"><h2 class="titulo-seccao">Por departamento</h2><div class="tabela-env"><table><thead><tr><th>Departamento</th><th class="n">Total</th><th class="n">Activas</th><th class="n">Concluídas</th><th class="n">Em atraso</th><th>Progresso médio</th></tr></thead><tbody>${ds.map(d => { const X = L.filter(a => a.departamento === d.codigo); const V = X.filter(viva); const m = V.length ? V.reduce((s, a) => s + (a.estado === "concluida" ? 1 : progresso(a)), 0) / V.length : 0; const b = bloqueadas(d.codigo).length; return `<tr class="clicavel" data-ir="#/d/${d.codigo}"><td><a href="#/d/${d.codigo}">${esc(d.nome_curto)}</a>${b ? ` <span class="rot rot-atraso">Bloqueado</span>` : ""}</td><td class="n">${X.length}</td><td class="n">${X.filter(aberta).length}</td><td class="n">${X.filter(a => a.estado === "concluida").length}</td><td class="n">${X.filter(a => situacao(a).atraso).length}</td><td><div class="barra-prog" style="width:110px;margin:6px 0 0"><i style="width:${m * 100}%"></i></div></td></tr>`; }).join("")}${semDept ? `<tr class="clicavel" data-ir="#/actividades?dept=_sem"><td><a href="#/actividades?dept=_sem">Por atribuir</a></td><td class="n">${semDept}</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="nota-pe">Atribuir em cada actividade</td></tr>` : ""}</tbody></table></div></section>`;
    } else {
      const prox = L.filter(a => aberta(a)).sort((x, y) => ordem(x) - ordem(y)).slice(0, 8);
      h += `<section class="sec"><h2 class="titulo-seccao">Próximas actividades <a href="#/actividades">Ver todas</a></h2>${prox.length ? `<div class="lista-act">${prox.map(linhaActividade).join("")}</div>` : `<div class="vazio">Sem actividades em curso.${podeCriar() ? ` <a href="#/nova">Registar actividade</a>` : ""}</div>`}</section>`;
    }
    h += `</div><aside><h2 class="titulo-seccao">Movimentos recentes</h2>${S.recentes.length ? S.recentes.map(movimento).join("") : `<div class="vazio">Ainda não há movimentos.</div>`}</aside></div>`;
    return h;
  }

  function filtradas() {
    const t = filtros.q.trim().toLowerCase();
    return [...S.acts.values()].filter(a => {
      if (a.semestre !== filtros.sem) return false;
      if (filtros.dept === "_sem" && a.departamento) return false;
      if (filtros.dept && filtros.dept !== "_sem" && !envolve(a, filtros.dept)) return false;
      const e = a.estado, s = situacao(a);
      if (filtros.estado === "atraso" && !s.atraso) return false;
      if (filtros.estado === "activa" && e !== "activa") return false;
      if (filtros.estado === "parecer" && !(e === "concluida" && !a.parecer)) return false;
      if (filtros.estado === "auditada" && !(e === "concluida" && a.parecer)) return false;
      if (["adiada", "cancelada", "nao_realizada"].includes(filtros.estado) && e !== filtros.estado) return false;
      if (t && !((a.titulo || "") + " " + (a.local || "") + " " + (a.grupo || "") + " " + nomeDept(a.departamento) + " " + (processo(a) || "")).toLowerCase().includes(t)) return false;
      return true;
    }).sort((x, y) => ordem(x) - ordem(y) || x.titulo.localeCompare(y.titulo, "pt"));
  }
  function pgActividades() {
    const L = filtradas();
    const sems = [...new Set([...S.acts.values()].map(a => a.semestre).concat(semestreActual()))].sort().reverse();
    let h = `<div class="cabeca-pagina"><div><h1>Actividades</h1><p>${eAdmin() ? "Todas as actividades do Núcleo." : "As actividades do seu departamento e aquelas em que participa."}</p></div><div class="accoes"><button class="btn" id="csv" type="button">Exportar CSV</button>${podeCriar() ? `<a class="btn btn-pri" href="#/nova">Nova actividade</a>` : ""}</div></div>
      <div class="filtros"><input type="search" id="f-q" placeholder="Procurar por título, local ou processo" value="${esc(filtros.q)}" aria-label="Procurar">
      ${eAdmin() || ["tes", "sg"].includes(meuDept()) ? `<select id="f-dept" aria-label="Departamento"><option value="">Todos os departamentos</option>${[...S.depts.values()].map(d => `<option value="${d.codigo}" ${filtros.dept === d.codigo ? "selected" : ""}>${esc(d.nome_curto)}</option>`).join("")}<option value="_sem" ${filtros.dept === "_sem" ? "selected" : ""}>Por atribuir</option></select>` : ""}
      <select id="f-estado" aria-label="Situação"><option value="">Todas as situações</option>${[["activa", "Activas"], ["atraso", "Fora do prazo"], ["parecer", "Aguardam parecer"], ["auditada", "Auditadas"], ["adiada", "Adiadas"], ["cancelada", "Canceladas"], ["nao_realizada", "Não realizadas"]].map(([k, l]) => `<option value="${k}" ${filtros.estado === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select id="f-sem" aria-label="Semestre">${sems.map(s => `<option value="${s}" ${filtros.sem === s ? "selected" : ""}>${esc(s.replace("-", " Semestre "))}</option>`).join("")}</select></div>`;
    if (filtros.sem !== semestreActual()) h += `<div class="caixa-info atraso" style="margin-bottom:18px"><p>Está a ver um semestre anterior. Actividades não realizadas só voltam ao circuito se o Conselho de Direcção decidir reprogramá-las; o Presidente cria então uma actividade nova (§9).</p></div>`;
    h += L.length ? listaPorMes(L) + `<p class="nota-pe" style="margin-top:14px">${L.length} actividade${L.length === 1 ? "" : "s"}</p>` : `<div class="vazio">${S.acts.size ? "Nenhuma actividade corresponde aos filtros." : "Ainda não há actividades." + (podeCriar() ? ` <a href="#/nova">Registar a primeira</a>` : "")}</div>`;
    return h;
  }
  function ligarFiltros() {
    const ao = (id, k, ev = "change") => { const el = $("#" + id); if (el) el.addEventListener(ev, () => { filtros[k] = el.value; guardaFiltros(); const pos = el.selectionStart; desenhar(); const n = $("#" + id); if (n && ev === "input") { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }); };
    ao("f-q", "q", "input"); ao("f-dept", "dept"); ao("f-estado", "estado"); ao("f-sem", "sem");
    const c = $("#csv"); if (c) c.onclick = exportarCSV;
  }
  function exportarCSV() {
    const L = filtradas(); const z = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const cab = ["Processo", "Actividade", "Tipo", "Departamento", "Departamentos envolvidos", "Data", "Mês", "Situação", "Progresso", "Orçamento (MT)", "Despesa (MT)", "Receita prevista (MT)", "Receita real (MT)", "Meta", "Participantes", "Parecer"];
    const linhas = L.map(a => [processo(a) || "", a.titulo, (TIPOS[a.tipo] || TIPOS.outra).n, nomeDept(a.departamento), (a.departamentos_envolvidos || []).map(curtoDept).join(", "), a.data || "", a.mes ? MESES_L[a.mes - 1] : "", situacao(a).l, pct(progresso(a)), a.orcamento ?? "", a.despesa ?? "", a.receita_prev ?? "", a.receita_real ?? "", a.meta ?? "", a.part_real ?? "", a.parecer ? OPINIOES[a.parecer.opiniao].l : ""].map(z).join(";"));
    const blob = new Blob(["﻿" + [cab.map(z).join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "NEFE-actividades-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function pgDepartamento(cod) {
    const d = S.depts.get(cod);
    if (!d) return `<div class="vazio">Departamento não encontrado.</div>`;
    if (!eAdmin() && cod !== meuDept()) return `<div class="vazio">Só tem acesso ao seu departamento. <a href="#/d/${esc(meuDept())}">Abrir ${esc(curtoDept(meuDept()))}</a></div>`;
    const L = [...S.acts.values()].filter(a => a.semestre === semestreActual());
    const prop = L.filter(a => a.departamento === cod).sort((x, y) => ordem(x) - ordem(y));
    const part = L.filter(a => a.departamento !== cod && (a.departamentos_envolvidos || []).includes(cod)).sort((x, y) => ordem(x) - ordem(y));
    const membros = [...S.perfis.values()].filter(p => p.departamento === cod && p.activo);
    const bl = bloqueadas(cod);
    let h = `<div class="cabeca-pagina"><div><h1>${esc(d.nome)}</h1><p>${esc(d.descricao || "")}</p></div>${(eChefe() && meuDept() === cod) || eDireccao() ? `<div class="accoes"><a class="btn btn-pri" href="#/nova${eDireccao() ? "?dept=" + cod : ""}">Nova actividade</a></div>` : ""}</div>`;
    if (bl.length) h += `<div class="caixa-info atraso" style="margin-bottom:20px"><p><b>Departamento bloqueado (§4.7).</b> Relatório em atraso: ${bl.map(a => `<a href="#/a/${a.id}">${esc(a.titulo)}</a>`).join(", ")}.</p></div>`;
    h += kpis(prop);
    h += `<div class="grelha g-2-1" style="margin-top:28px"><div><section class="sec"><h2 class="titulo-seccao">Actividades do departamento</h2>${prop.length ? listaPorMes(prop) : `<div class="vazio">Sem actividades neste semestre.</div>`}</section>
      ${part.length ? `<section class="sec"><h2 class="titulo-seccao">Participa também em</h2>${listaPorMes(part)}</section>` : ""}</div>
      <aside><h2 class="titulo-seccao">Membros</h2>${membros.length ? `<dl class="dados">${membros.map(p => `<div><dt>${esc(CARGOS[p.cargo] || p.cargo)}</dt><dd>${esc(p.nome)}</dd></div>`).join("")}</dl>` : `<div class="vazio">Sem membros registados.</div>`}</aside></div>`;
    return h;
  }

  // ---------- Ficha da actividade ----------
  function pgFicha(id) {
    const a = S.acts.get(id);
    if (!a) return `<div class="vazio">Actividade não encontrada, ou sem acesso. <a href="#/actividades">Voltar</a></div>`;
    const s = situacao(a), e = a.estado, tp = TIPOS[a.tipo] || TIPOS.outra;
    const f = e === "concluida" ? (feito(a, "f7_par") ? 8 : 7) : faseDe(a);
    const b = [];
    if (podeConcluir(a)) b.push(`<button class="btn btn-pri" data-accao="concluir">Concluir actividade</button>`);
    if (podeEditar(a)) b.push(`<a class="btn" href="#/a/${a.id}/editar">Editar dados</a>`);
    if (podeValores(a)) b.push(`<button class="btn" data-accao="valores">Registar valores reais</button>`);
    if (podeAgenda(a)) b.push(`<button class="btn" data-accao="agenda">${a.visivel_publico ? "Agenda pública: visível" : "Mostrar na agenda pública"}</button>`);
    if (podeAdiar(a)) b.push(`<button class="btn" data-accao="adiar">Adiar</button>`);
    if (podeCancelar(a)) b.push(`<button class="btn btn-perigo" data-accao="cancelar">Cancelar</button>`);
    if (ePres() && ["adiada", "cancelada"].includes(e)) b.push(`<button class="btn" data-accao="retomar">Retomar</button>`);
    if (ePres() && e === "nao_realizada" && !a.reprogramada_para) b.push(`<button class="btn btn-pri" data-accao="reprogramar">Reprogramar no semestre actual</button>`);
    if (eAud() && e === "concluida" && !a.parecer) b.push(`<button class="btn btn-pri" data-accao="parecer">Emitir parecer</button>`);
    if (ePres()) b.push(`<button class="btn btn-simples btn-perigo" data-accao="eliminar">Eliminar registo</button>`);
    const env = (a.departamentos_envolvidos || []);
    let h = `<p style="margin:0 0 12px"><a href="#/actividades" class="nota-pe">← Actividades</a></p>
    <div class="ficha-cab"><div class="sobre">${processo(a) ? "Processo " + esc(processo(a)) : "Processo por abrir"} · ${esc(tp.n)}</div><h1>${esc(a.titulo)}</h1>
      <div class="meta">${rotSit(s)}<span>${esc(nomeDept(a.departamento))}</span>${env.length ? `<span>Envolvidos: ${esc(env.map(curtoDept).join(", "))}</span>` : ""}${s.txt ? `<span style="color:var(--atraso)">${esc(s.txt)}</span>` : ""}</div>
      ${b.length ? `<div class="accoes">${b.join("")}</div>` : ""}</div>`;
    const avisos = [];
    if (a.origem_plano && aberta(a) && (!a.departamento || !a.data || a.orcamento == null)) avisos.push(`<div class="caixa-info atraso"><p>Importada do Plano Semestral. Falta${[!a.departamento, !a.data, a.orcamento == null].filter(Boolean).length > 1 ? "m" : ""} ${[!a.departamento && "o departamento responsável", !a.data && "a data", a.orcamento == null && "o orçamento em meticais"].filter(Boolean).join(", ")}.</p>${podeEditar(a) ? `<a class="btn" href="#/a/${a.id}/editar">Completar</a>` : ""}</div>`);
    if (a.motivo && ["cancelada", "adiada", "nao_realizada"].includes(e)) avisos.push(`<div class="caixa-info ${e === "cancelada" ? "erro" : "atraso"}"><p><b>${e === "cancelada" ? "Motivo do cancelamento" : e === "adiada" ? "Motivo do adiamento" : "Situação"}:</b> ${esc(a.motivo)}</p></div>`);
    if (a.forcada) avisos.push(`<div class="caixa-info atraso"><p><b>Concluída com ${esc(a.forcada.pendentes)} passo(s) em falta</b> por ${esc(nome(a.forcada.por))}: ${esc(a.forcada.motivo)}</p></div>`);
    if (a.reprogramada_para) avisos.push(`<div class="caixa-info"><p>Reprogramada no semestre actual.</p>${S.acts.get(a.reprogramada_para) ? `<a class="btn" href="#/a/${a.reprogramada_para}">Abrir a nova actividade</a>` : ""}</div>`);
    if (a.origem && S.acts.get(a.origem)) avisos.push(`<div class="caixa-info"><p>Reprogramação de uma actividade não realizada.</p><a class="btn" href="#/a/${a.origem}">Ver original</a></div>`);
    if (avisos.length) h += `<div class="grelha" style="gap:10px;margin-bottom:22px">${avisos.join("")}</div>`;

    // linha do tempo
    h += `<section class="sec"><h2 class="titulo-seccao">Ciclo de vida <span class="nota-pe" style="text-transform:none;letter-spacing:0;font-weight:400">D = ${a.data ? fData(a.data) : "data por definir"}</span></h2><div class="linha-tempo"><ol>${FASES.map(x => { const cls = x.n < f ? "f" : (x.n === f && viva(a) ? (s.atraso ? "a" : "c") : ""); return `<li class="${cls}"><span class="k">${x.k}</span><b>${x.n}. ${x.nome}</b><span class="nota-pe">${a.data ? fCurta(prazoFase(a, x.n)) : ""}</span></li>`; }).join("")}</ol></div></section>`;

    h += `<div class="grelha g-2-1"><div>`;
    // passos
    h += `<section class="sec"><h2 class="titulo-seccao">Passos por fase <span class="nota-pe" style="text-transform:none;letter-spacing:0;font-weight:400">${pct(progresso(a))} concluído</span></h2>${FASES.map(x => { const P = passosFase(a, x.n); if (!P.length) return ""; const lim = prazoFase(a, x.n); return `<div class="fase"><h4>${x.n}. ${x.nome}<span>${x.ref}${lim ? " · até " + fCurta(lim) : ""}</span></h4>${P.map(p => passoHTML(a, p)).join("")}</div>`; }).join("")}</section>`;
    const PT = passosTipo(a);
    if (PT.length || tp.c) h += `<section class="sec"><h2 class="titulo-seccao">Regras do tipo de actividade <span class="nota-pe" style="text-transform:none;letter-spacing:0;font-weight:400">${tp.ref}</span></h2>${PT.map(p => passoHTML(a, p)).join("")}${tp.c ? `<div class="caixa-info" style="margin-top:12px"><p><b>Controlo do Conselho Fiscal:</b> ${esc(tp.c)}</p></div>` : ""}</section>`;
    // tarefas
    const T = S.ficha.id === a.id ? S.ficha.tarefas : [];
    const pt = podeTarefas(a);
    h += `<section class="sec"><h2 class="titulo-seccao">Tarefas internas do departamento</h2>${T.length ? T.map(t => `<div class="passo ${t.feito ? "feito" : ""}"><input type="checkbox" id="t-${t.id}" data-tarefa="${t.id}" ${t.feito ? "checked" : ""} ${pt ? "" : "disabled"}><label for="t-${t.id}">${esc(t.texto)}</label><div class="quem">${t.feito && t.feito_por ? `<span>Feita por ${esc(nome(t.feito_por))}, ${esc(fCarimbo(t.feito_em))}</span>` : `<span>Criada por ${esc(nome(t.criado_por))}</span>`}${pt ? `<a href="#" data-apagar-tarefa="${t.id}">remover</a>` : ""}</div></div>`).join("") : `<p class="nota-pe" style="margin:0">Sem tarefas. ${pt ? "Registe aqui as pendências internas do departamento." : ""}</p>`}${pt ? `<form class="tarefa-nova" id="form-tarefa"><input type="text" id="tarefa-texto" maxlength="300" placeholder="Nova tarefa, por exemplo: confirmar a sala com a Faculdade" aria-label="Nova tarefa"><button class="btn" type="submit">Acrescentar</button></form>` : ""}</section>`;
    // histórico
    const H = S.ficha.id === a.id ? S.ficha.hist : [];
    h += `<section class="sec"><h2 class="titulo-seccao">Histórico e notas</h2><form id="form-nota" style="display:flex;gap:8px;margin-bottom:12px;align-items:flex-start"><textarea id="nota-texto" rows="2" style="min-height:60px" maxlength="2000" placeholder="Escrever uma nota (fica registada com o seu nome e a hora)" aria-label="Nova nota"></textarea><button class="btn" type="submit">Registar</button></form>${H.length ? H.map(movimento).join("") : `<p class="nota-pe">Sem movimentos.</p>`}</section>`;
    h += `</div><aside>`;
    // dados
    h += `<section class="sec"><h2 class="titulo-seccao">Dados</h2><dl class="dados">
      <div><dt>Data</dt><dd>${a.data ? esc(fData(a.data)) : (a.mes ? MESES_L[a.mes - 1] + " (dia por definir)" : "Por definir")}</dd></div>
      <div><dt>Local</dt><dd>${esc(a.local || "—")}</dd></div><div><dt>Público-alvo</dt><dd>${esc(a.publico_alvo || "—")}</dd></div>
      <div><dt>Oradores</dt><dd>${esc(a.oradores || "—")}</dd></div><div><dt>Meta</dt><dd>${a.meta != null ? esc(a.meta) + " participantes" : "—"}</dd></div>
      <div><dt>Classificação</dt><dd>${[a.tem_receitas && "Com receitas", a.autossustentavel && "Autossustentável", a.patrocinavel && "Patrocinável", a.estrutural && "Despesa estrutural", a.grupo].filter(Boolean).map(x => `<span class="etiqueta">${esc(x)}</span>`).join(" ") || "—"}</dd></div>
      <div><dt>Objectivo</dt><dd>${esc(a.objectivo || "—")}</dd></div>
      <div><dt>Registada por</dt><dd>${esc(nome(a.criado_por))}, ${esc(fData(a.criado_em))}</dd></div></dl></section>`;
    const ex = +a.orcamento > 0 && a.despesa != null ? a.despesa / a.orcamento : null;
    h += `<section class="sec"><h2 class="titulo-seccao">Orçamento e execução</h2><div class="fin">
      <div><small>Orçamento</small><b>${mt(a.orcamento)}</b></div><div><small>Despesa real</small><b>${mt(a.despesa)}</b></div>
      <div><small>Receita prevista</small><b>${mt(a.receita_prev)}</b></div><div><small>Receita real</small><b>${mt(a.receita_real)}</b></div>
      <div><small>Execução</small><b style="color:${ex === null ? "inherit" : (ex >= .9 && ex <= 1.1 ? "var(--verde)" : "var(--atraso)")}">${ex === null ? "—" : pct(ex)}</b></div><div><small>Participantes</small><b>${a.part_real ?? "—"}${a.meta != null ? " / " + a.meta : ""}</b></div></div>
      ${a.tem_receitas ? `<p class="nota-pe">Receitas com recibo ou bilhete numerado, contagem a duas pessoas, depósito em 48 horas e 10% para a reserva (§5.2, §5.4).</p>` : ""}</section>`;
    if (a.visivel_publico) h += `<section class="sec"><h2 class="titulo-seccao">Na agenda pública</h2><p style="margin:0">${esc(a.resumo_publico || "Sem resumo.")}</p><p class="nota-pe">Os estudantes vêem o título, a data, o local e este resumo. Orçamentos e passos nunca são públicos.</p></section>`;
    if (a.parecer) { const o = OPINIOES[a.parecer.opiniao] || OPINIOES.sem_reservas; h += `<section class="sec"><h2 class="titulo-seccao">Parecer do Conselho Fiscal</h2><span class="carimbo ${o.c}">${o.l}</span><dl class="dados"><div><dt>Constatações</dt><dd>${esc(a.parecer.constatacoes || "—")}</dd></div><div><dt>Recomendações</dt><dd>${esc(a.parecer.recomendacoes || "—")}</dd></div><div><dt>Emitido por</dt><dd>${esc(nome(a.parecer.por))}, ${esc(fCarimbo(a.parecer.em))}</dd></div></dl></section>`; }
    else if (e === "concluida" || eAdmin()) h += `<section class="sec"><h2 class="titulo-seccao">Indicadores (§7)</h2>${indicadores(a).map(indHTML).join("")}</section>`;
    h += `</aside></div>`;
    return h;
  }
  const indHTML = x => `<div class="ind"><span>${esc(x.n)}</span><small>${esc(x.d)}</small><span class="rot ${x.ok === null ? "rot-cinza" : x.ok ? "rot-verde" : "rot-atraso"}">${x.ok === null ? "Por medir" : x.ok ? "Na meta" : "Fora da meta"}</span></div>`;
  function passoHTML(a, p) {
    const r = registo(a, p.chave), f = !!(r && r.feito), pode = podeMarcar(a, p);
    const quem = r ? (r.feito ? `<span>Confirmado por ${esc(nome(r.por))}, ${esc(fCarimbo(r.em))}</span>` : `<span>Desmarcado por ${esc(nome(r.por))}, ${esc(fCarimbo(r.em))}</span>`) : "";
    return `<div class="passo ${f ? "feito" : ""}"><input type="checkbox" id="p-${p.chave}" data-passo="${p.chave}" ${f ? "checked" : ""} ${pode ? "" : "disabled"}><label for="p-${p.chave}">${esc(p.texto)}${p.opcional && !condOk(a, p) ? ` <i class="nota-pe">(opcional, por amostragem)</i>` : ""}</label><div class="quem"><span class="papel">${esc(papelNome(a, p))}</span>${quem}</div></div>`;
  }
  function ligarFicha(id) {
    const a = S.acts.get(id); if (!a) return;
    $$("[data-passo]").forEach(el => el.addEventListener("change", async () => {
      const ch = el.dataset.passo, v = el.checked;
      const ok = await escrever(() => sb.from("checklist").upsert({ actividade_id: a.id, chave: ch, feito: v }, { onConflict: "actividade_id,chave" }), v ? "Passo confirmado." : "Passo desmarcado.");
      if (!ok) el.checked = !v;
    }));
    $$("[data-tarefa]").forEach(el => el.addEventListener("change", async () => {
      const ok = await escrever(() => actualizar("tarefas", el.dataset.tarefa, { feito: el.checked }));
      if (!ok) el.checked = !el.checked;
    }));
    $$("[data-apagar-tarefa]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); escrever(() => sb.from("tarefas").delete().eq("id", el.dataset.apagarTarefa), "Tarefa removida."); }));
    const ft = $("#form-tarefa"); if (ft) ft.addEventListener("submit", e => { e.preventDefault(); const t = $("#tarefa-texto").value.trim(); if (!t) return; escrever(() => sb.from("tarefas").insert({ actividade_id: a.id, texto: t }), "Tarefa acrescentada."); });
    const fn = $("#form-nota"); if (fn) fn.addEventListener("submit", e => { e.preventDefault(); const t = $("#nota-texto").value.trim(); if (!t) return; escrever(() => sb.from("historico").insert({ actividade_id: a.id, texto: t, tipo: "nota" }), "Nota registada."); });
    $$("[data-accao]").forEach(el => el.addEventListener("click", () => ACCOES[el.dataset.accao] && ACCOES[el.dataset.accao](a)));
  }

  const ACCOES = {
    concluir(a) {
      const falta = emFalta(a);
      abrirJanela(`<form class="form"><h2 class="inteiro">Concluir actividade</h2>${falta.length ? `<p class="aviso-form">Faltam ${falta.length} passo${falta.length > 1 ? "s" : ""} obrigatório${falta.length > 1 ? "s" : ""} das fases 1 a 6:</p><ul class="inteiro" style="margin:0;padding-left:20px;font-size:14px">${falta.map(p => `<li>${p.fase}. ${esc(p.texto)}</li>`).join("")}</ul><div class="campo inteiro"><label for="c-motivo">Justificação para concluir assim</label><textarea id="c-motivo" name="motivo" required minlength="5"></textarea><small>Fica registada e aparece ao Conselho Fiscal como sinal de alerta.</small></div>` : `<p class="aviso-form ok">Todos os passos das fases 1 a 6 estão feitos. A actividade passa ao Conselho Fiscal, que emite parecer até 15 dias depois.</p>`}${rodapeJanela(falta.length ? "Concluir com passos em falta" : "Concluir")}</form>`,
        fd => { const m = (fd.get("motivo") || "").trim(); if (falta.length && m.length < 5) { aviso("Escreva a justificação.", "erro"); return false; }
          return escrever(() => actualizar("actividades", a.id, { estado: "concluida", forcada: falta.length ? { motivo: m } : null }), "Actividade concluída."); });
    },
    valores(a) {
      abrirJanela(`<form class="form"><h2 class="inteiro">Registar valores reais</h2><p class="nota-pe inteiro" style="margin:0">Conferidos com os comprovativos (§5.1).</p>
        <div class="campo"><label for="v-desp">Despesa real (MT)</label><input type="number" id="v-desp" name="despesa" min="0" step="0.01" value="${a.despesa ?? ""}"></div>
        <div class="campo"><label for="v-rec">Receita real (MT)</label><input type="number" id="v-rec" name="receita_real" min="0" step="0.01" value="${a.receita_real ?? ""}"></div>
        <div class="campo"><label for="v-part">Participantes</label><input type="number" id="v-part" name="part_real" min="0" step="1" value="${a.part_real ?? ""}"></div>${rodapeJanela("Guardar")}</form>`,
        fd => { const n = k => fd.get(k) === "" ? null : Number(fd.get(k)); return escrever(() => actualizar("actividades", a.id, { despesa: n("despesa"), receita_real: n("receita_real"), part_real: n("part_real") }), "Valores guardados."); });
    },
    agenda(a) {
      abrirJanela(`<form class="form"><h2 class="inteiro">Agenda pública do site</h2><p class="nota-pe inteiro" style="margin:0">Os estudantes vêem só o título, a data, o local e o resumo abaixo.</p>
        <div class="campo inteiro"><label class="opcoes"><label><input type="checkbox" name="visivel" ${a.visivel_publico ? "checked" : ""}> Mostrar esta actividade na agenda pública</label></label></div>
        <div class="campo inteiro"><label for="ag-resumo">Resumo público</label><textarea id="ag-resumo" name="resumo" maxlength="400">${esc(a.resumo_publico || "")}</textarea></div>${rodapeJanela("Guardar")}</form>`,
        fd => escrever(() => actualizar("actividades", a.id, { visivel_publico: fd.get("visivel") === "on", resumo_publico: (fd.get("resumo") || "").trim() }), "Agenda pública actualizada."));
    },
    adiar(a) {
      abrirJanela(`<form class="form"><h2 class="inteiro">Adiar actividade</h2><div class="campo inteiro"><label for="ad-m">Motivo</label><textarea id="ad-m" name="motivo" required></textarea></div><div class="campo"><label for="ad-d">Nova data (se já conhecida)</label><input type="date" id="ad-d" name="data"></div><p class="nota-pe inteiro">A actividade sai do circuito até o Presidente a retomar. Os passos feitos mantêm-se.</p>${rodapeJanela("Adiar")}</form>`,
        fd => { const m = (fd.get("motivo") || "").trim(); if (m.length < 3) { aviso("Indique o motivo.", "erro"); return false; } const v = { estado: "adiada", motivo: m }; if (fd.get("data")) v.data = fd.get("data"); return escrever(() => actualizar("actividades", a.id, v), "Actividade adiada."); });
    },
    cancelar(a) {
      abrirJanela(`<form class="form"><h2 class="inteiro">Cancelar actividade</h2><div class="campo inteiro"><label for="ca-m">Motivo do cancelamento</label><textarea id="ca-m" name="motivo" required></textarea></div><p class="nota-pe inteiro">A Tesouraria deve informar se houve despesas, adiantamentos ou bilhetes vendidos e o seu destino (§9). O cancelamento conta como actividade não realizada na execução do Plano.</p>${rodapeJanela("Cancelar actividade", "btn-perigo")}</form>`,
        fd => { const m = (fd.get("motivo") || "").trim(); if (m.length < 3) { aviso("Indique o motivo.", "erro"); return false; } return escrever(() => actualizar("actividades", a.id, { estado: "cancelada", motivo: m }), "Actividade cancelada."); });
    },
    retomar(a) { escrever(() => actualizar("actividades", a.id, { estado: "activa" }), "Actividade retomada."); },
    reprogramar(a) {
      abrirJanela(`<form class="form"><h2 class="inteiro">Reprogramar no semestre actual</h2><p class="nota-pe inteiro" style="margin:0">Por decisão do Conselho de Direcção (§9), cria-se uma actividade nova com nova proposta, novo orçamento e nova aprovação.</p>
        <div class="campo"><label for="r-dep">Departamento responsável</label><select id="r-dep" name="departamento"><option value="">Por atribuir</option>${DEPTS_OPERATIVOS.concat(["pres"]).map(c => `<option value="${c}" ${a.departamento === c ? "selected" : ""}>${esc(nomeDept(c))}</option>`).join("")}</select></div>
        <div class="campo"><label for="r-data">Nova data</label><input type="date" id="r-data" name="data"></div>${rodapeJanela("Criar actividade nova")}</form>`,
        async fd => {
          try {
            const nova = await q(sb.from("actividades").insert({ titulo: a.titulo, tipo: a.tipo, departamento: fd.get("departamento") || null, data: fd.get("data") || null, objectivo: a.objectivo, grupo: a.grupo, tem_receitas: a.tem_receitas, autossustentavel: a.autossustentavel, patrocinavel: a.patrocinavel, estrutural: a.estrutural, origem: a.id, departamentos_envolvidos: a.departamentos_envolvidos }).select("id").single());
            await q(actualizar("actividades", a.id, { reprogramada_para: nova.id }));
            await carregarActividades(); aviso("Actividade reprogramada."); location.hash = "#/a/" + nova.id; return true;
          } catch (e) { aviso(mensagemErro(e), "erro"); return false; }
        });
    },
    parecer(a) {
      const I = indicadores(a), fora = I.filter(x => x.ok === false).length, sug = fora >= 2 || a.forcada ? "com_reservas" : "sem_reservas";
      abrirJanela(`<form class="form"><h2 class="inteiro">Parecer do Conselho Fiscal</h2><p class="nota-pe inteiro" style="margin:0">${esc(a.titulo)}</p>
        <div class="inteiro">${I.map(indHTML).join("")}</div>
        <p class="aviso-form ${fora >= 2 ? "" : "ok"}">${fora} indicador${fora === 1 ? "" : "es"} fora da meta${a.forcada ? " e conclusão com passos em falta" : ""}. Sugestão pela regra do Manual: <b>${OPINIOES[sug].l}</b>.</p>
        <div class="campo inteiro"><span class="rotulo">Opinião</span><div class="opcoes">${Object.entries(OPINIOES).map(([k, o]) => `<label><input type="radio" name="opiniao" value="${k}" ${k === sug ? "checked" : ""}> ${o.l}</label>`).join("")}</div></div>
        <div class="campo inteiro"><label for="pa-c">Constatações e documentos verificados</label><textarea id="pa-c" name="constatacoes" required></textarea></div>
        <div class="campo inteiro"><label for="pa-r">Recomendações</label><textarea id="pa-r" name="recomendacoes"></textarea></div>${rodapeJanela("Emitir parecer")}</form>`,
        fd => { const c = (fd.get("constatacoes") || "").trim(); if (!c) { aviso("Escreva as constatações.", "erro"); return false; }
          return escrever(() => actualizar("actividades", a.id, { parecer: { opiniao: fd.get("opiniao"), constatacoes: c, recomendacoes: (fd.get("recomendacoes") || "").trim(), indicadores_fora: fora } }), "Parecer emitido."); });
    },
    eliminar(a) {
      abrirJanela(`<form class="form"><h2 class="inteiro">Eliminar «${esc(a.titulo)}»?</h2><p class="aviso-form">Use só para registos feitos por engano. Uma actividade que não se realiza deve ser cancelada, para ficar no histórico e contar na execução do Plano.</p>${rodapeJanela("Eliminar definitivamente", "btn-perigo")}</form>`,
        async () => { try { const r = await sb.from("actividades").delete().eq("id", a.id).select("id"); if (r.error) throw r.error; if (!r.data || !r.data.length) throw new Error("Sem permissão para esta acção."); await carregarActividades(); aviso("Registo eliminado."); location.hash = "#/actividades"; return true; } catch (e) { aviso(mensagemErro(e), "erro"); return false; } });
    }
  };

  // ---------- Formulário de actividade (nova / editar) ----------
  function pgFormActividade(id) {
    const a = id ? S.acts.get(id) : null;
    if (id && !a) return `<div class="vazio">Actividade não encontrada.</div>`;
    if (a && !podeEditar(a)) return `<div class="vazio">Não pode editar esta actividade. <a href="#/a/${a.id}">Voltar</a></div>`;
    if (!a && !podeCriar()) return `<div class="vazio">Só os chefes de departamento, o Presidente e a Vice-Presidente registam actividades.</div>`;
    const v = a || {};
    const pedido = new URLSearchParams((location.hash.split("?")[1]) || "").get("dept");
    const dept = v.departamento || (eChefe() ? meuDept() : (pedido || ""));
    const bl = !a && dept && !ePres() ? bloqueadas(dept) : [];
    const env = new Set(a ? (v.departamentos_envolvidos || []) : ["uga", "log", "com"]);
    const opcoesEnv = DEPTS_OPERATIVOS.filter(c => c !== dept);
    return `<p style="margin:0 0 12px"><a href="${a ? "#/a/" + a.id : "#/actividades"}" class="nota-pe">← ${a ? "Voltar à actividade" : "Actividades"}</a></p>
    <div class="cabeca-pagina"><div><h1>${a ? "Editar actividade" : "Nova actividade"}</h1><p>Proposta da actividade (§4.1). Os prazos de cada fase são calculados a partir da data.</p></div></div>
    <form class="form" id="form-act" novalidate style="max-width:860px">
      ${bl.length ? `<p class="aviso-form">O departamento tem relatório em atraso (${bl.map(x => esc(x.titulo)).join(", ")}). Pela regra de bloqueio (§4.7), só o Presidente pode autorizar actividade nova.</p>` : ""}
      <div class="campo inteiro"><label for="a-titulo">Título</label><input type="text" id="a-titulo" name="titulo" required maxlength="160" value="${esc(v.titulo || "")}"></div>
      <div class="campo"><label for="a-tipo">Tipo de actividade</label><select id="a-tipo" name="tipo">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${(v.tipo || "palestra") === k ? "selected" : ""}>${esc(t.n)} (${t.ref})</option>`).join("")}</select></div>
      <div class="campo"><label for="a-dept">Departamento responsável</label><select id="a-dept" name="departamento" ${eDireccao() ? "" : "disabled"}><option value="">Por atribuir</option>${DEPTS_OPERATIVOS.concat(["pres"]).map(c => `<option value="${c}" ${dept === c ? "selected" : ""}>${esc(nomeDept(c))}</option>`).join("")}</select>${eDireccao() ? "" : `<small>Só o Presidente ou a Vice-Presidente mudam o departamento.</small>`}</div>
      <div class="campo inteiro"><span class="rotulo">Departamentos envolvidos</span><div class="opcoes" id="a-env">${opcoesEnv.map(c => `<label><input type="checkbox" name="env" value="${c}" ${["tes", "sg"].includes(c) ? "checked disabled" : (env.has(c) ? "checked" : "")}> ${esc(curtoDept(c))}</label>`).join("")}</div><small>Os departamentos envolvidos vêem a actividade e marcam os seus passos. A Tesouraria e a Secretaria-Geral entram sempre (fundos e processo, §4.2).</small></div>
      <div class="campo"><label for="a-data">Data</label><input type="date" id="a-data" name="data" value="${esc(v.data || "")}"></div>
      <div class="campo"><label for="a-mes">Mês previsto (se ainda sem data)</label><select id="a-mes" name="mes"><option value="">—</option>${MESES_L.map((m, i) => `<option value="${i + 1}" ${v.mes === i + 1 ? "selected" : ""}>${m}</option>`).join("")}</select></div>
      <div class="campo"><label for="a-local">Local</label><input type="text" id="a-local" name="local" value="${esc(v.local || "")}"></div>
      <div class="campo"><label for="a-publico">Público-alvo</label><input type="text" id="a-publico" name="publico_alvo" value="${esc(v.publico_alvo || "")}"></div>
      <div class="campo"><label for="a-oradores">Oradores ou formadores</label><input type="text" id="a-oradores" name="oradores" value="${esc(v.oradores || "")}"></div>
      <div class="campo"><label for="a-meta">Meta de participação</label><input type="number" id="a-meta" name="meta" min="0" step="1" value="${v.meta ?? ""}"></div>
      <div class="campo"><label for="a-orc">Orçamento (MT)</label><input type="number" id="a-orc" name="orcamento" min="0" step="0.01" value="${v.orcamento ?? ""}"></div>
      <div class="campo"><label for="a-rp">Receita prevista (MT)</label><input type="number" id="a-rp" name="receita_prev" min="0" step="0.01" value="${v.receita_prev ?? ""}"></div>
      <div class="campo inteiro"><label for="a-obj">Objectivo e descrição</label><textarea id="a-obj" name="objectivo">${esc(v.objectivo || "")}</textarea></div>
      <div class="campo"><label for="a-grupo">Agrupamento (opcional)</label><input type="text" id="a-grupo" name="grupo" placeholder="Ex.: NEFE Week" value="${esc(v.grupo || "")}"></div>
      <div class="campo inteiro"><span class="rotulo">Classificação</span><div class="opcoes">
        <label><input type="checkbox" name="tem_receitas" ${v.tem_receitas ? "checked" : ""}> Tem receitas (bilhetes, bancas, propinas, donativos)</label>
        <label><input type="checkbox" name="autossustentavel" ${v.autossustentavel ? "checked" : ""}> Autossustentável</label>
        <label><input type="checkbox" name="patrocinavel" ${v.patrocinavel ? "checked" : ""}> Patrocinável</label>
        <label><input type="checkbox" name="estrutural" ${v.estrutural ? "checked" : ""}> Despesa estrutural (aprovação do Conselho de Direcção)</label></div></div>
      <div class="rodape-form"><a class="btn" href="${a ? "#/a/" + a.id : "#/actividades"}">Cancelar</a><button class="btn btn-pri" type="submit" ${bl.length ? "disabled" : ""}>${a ? "Guardar alterações" : "Registar actividade"}</button></div>
    </form>`;
  }
  function ligarFormActividade(id) {
    const f = $("#form-act"); if (!f) return;
    const sel = $("#a-dept");
    if (sel && eDireccao()) sel.addEventListener("change", () => {
      const d = sel.value, marcados = new Set($$("input[name=env]:checked").map(x => x.value));
      $("#a-env").innerHTML = DEPTS_OPERATIVOS.filter(c => c !== d).map(c => `<label><input type="checkbox" name="env" value="${c}" ${["tes", "sg"].includes(c) ? "checked disabled" : (marcados.has(c) ? "checked" : "")}> ${esc(curtoDept(c))}</label>`).join("");
    });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(f), n = k => fd.get(k) === "" || fd.get(k) === null ? null : Number(fd.get(k));
      const titulo = (fd.get("titulo") || "").trim();
      if (titulo.length < 3) { aviso("Indique o título da actividade.", "erro"); return; }
      const dados = {
        titulo, tipo: fd.get("tipo"), data: fd.get("data") || null, mes: n("mes"), local: (fd.get("local") || "").trim(),
        publico_alvo: (fd.get("publico_alvo") || "").trim(), oradores: (fd.get("oradores") || "").trim(), meta: n("meta"),
        orcamento: n("orcamento"), receita_prev: n("receita_prev"), objectivo: (fd.get("objectivo") || "").trim(), grupo: (fd.get("grupo") || "").trim(),
        tem_receitas: fd.get("tem_receitas") === "on", autossustentavel: fd.get("autossustentavel") === "on", patrocinavel: fd.get("patrocinavel") === "on", estrutural: fd.get("estrutural") === "on",
        departamentos_envolvidos: fd.getAll("env"), origem_plano: false
      };
      if (eDireccao()) dados.departamento = fd.get("departamento") || null;
      else if (!id) dados.departamento = meuDept();
      const b = $("button[type=submit]", f); b.disabled = true;
      try {
        if (id) { await q(actualizar("actividades", id, dados)); await carregarActividades(); aviso("Alterações guardadas."); location.hash = "#/a/" + id; }
        else { const nova = await q(sb.from("actividades").insert(dados).select("id").single()); await carregarActividades(); aviso("Actividade registada."); location.hash = "#/a/" + nova.id; }
      } catch (er) { aviso(mensagemErro(er), "erro"); b.disabled = false; }
    });
  }

  // ---------- Auditoria ----------
  function pgAuditoria() {
    if (!eAdmin()) return `<div class="vazio">Área reservada à Presidência, Vice-Presidência e Conselho Fiscal.</div>`;
    const L = [...S.acts.values()].filter(a => a.semestre === semestreActual());
    const conc = L.filter(a => a.estado === "concluida");
    const t = { ap: [0, 0], ps: [0, 0], dp: [0, 0], eo: [0, 0], rl: [0, 0], au: [0, 0] };
    const conta = (k, x) => { if (x && x.ok !== null) { t[k][1]++; if (x.ok) t[k][0]++; } };
    L.filter(viva).forEach(a => { const I = indicadores(a), g = p => I.find(x => x.n.startsWith(p)); conta("ap", g("Aprovação")); conta("ps", g("Ponto")); conta("dp", g("Depósito")); conta("eo", g("Execução orçamental")); conta("rl", g("Prestação")); conta("au", g("Autossust")); });
    const ind = [["Execução do Plano Semestral", conc.length, L.length, .8, "≥ 80%"], ["Aprovação prévia", ...t.ap, 1, "100%"], ["Ponto de situação dentro do prazo", ...t.ps, 1, "100%"], ["Depósito dentro do prazo", ...t.dp, 1, "100%"], ["Execução orçamental entre 90% e 110%", ...t.eo, 1, "100%"], ["Prestação de contas dentro do prazo", ...t.rl, .9, "≥ 90%"], ["Autossustentabilidade", ...t.au, 1, "receitas ≥ custos"]];
    const espera = conc.filter(a => !a.parecer).sort((x, y) => ordem(x) - ordem(y));
    const pareceres = conc.filter(a => a.parecer).sort((x, y) => (y.parecer.em || "").localeCompare(x.parecer.em || ""));
    const A = alertas();
    return `<div class="cabeca-pagina"><div><h1>Auditoria</h1><p>Conselho Fiscal · indicadores, alertas e pareceres do ${esc(semestreActual().replace("-", " Semestre "))}</p></div></div>
    <div class="grelha g-2-1"><div>
      <section class="sec"><h2 class="titulo-seccao">Indicadores do semestre (§7)</h2>${ind.map(([n, num, den, meta, m]) => { const v = den ? num / den : null, ok = v === null ? null : v >= meta; return `<div class="ind"><span>${esc(n)} <span class="valor">${v === null ? "—" : pct(v)}</span></span><small>Meta: ${esc(m)} · ${num} de ${den}</small><span class="rot ${ok === null ? "rot-cinza" : ok ? "rot-verde" : "rot-atraso"}">${ok === null ? "Sem dados" : ok ? "Na meta" : "Fora da meta"}</span></div>`; }).join("")}<p class="nota-pe">Despesas documentadas, concorrência nas compras e integridade dos certificados verificam-se no processo físico.</p></section>
      <section class="sec"><h2 class="titulo-seccao">Aguardam parecer</h2>${espera.length ? espera.map(a => { const lim = a.data ? somaDias(a.data, 15) : null, v = lim && fimDoDia(lim) < new Date(), fora = indicadores(a).filter(x => x.ok === false).length; return `<a class="pend" href="#/a/${a.id}"><b>${esc(a.titulo)}</b><small>${esc(curtoDept(a.departamento))} · ${fora} indicador${fora === 1 ? "" : "es"} fora da meta${a.forcada ? " · concluída com passos em falta" : ""}</small><span class="prazo ${v ? "vencido" : ""}">${lim ? (v ? "Venceu " : "Até ") + fCurta(lim) : "Sem data"}</span></a>`; }).join("") : `<div class="vazio">Nenhuma actividade à espera de parecer.</div>`}</section>
      <section class="sec"><h2 class="titulo-seccao">Pareceres emitidos</h2>${pareceres.length ? `<div class="tabela-env"><table><thead><tr><th>Actividade</th><th>Opinião</th><th>Data</th></tr></thead><tbody>${pareceres.map(a => { const o = OPINIOES[a.parecer.opiniao]; return `<tr class="clicavel" data-ir="#/a/${a.id}"><td><a href="#/a/${a.id}">${esc(a.titulo)}</a></td><td><span class="rot rot-${o.c === "ok" ? "verde" : o.c}">${o.l}</span></td><td>${esc(fData(a.parecer.em))}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="vazio">Ainda sem pareceres.</div>`}</section>
    </div><aside><h2 class="titulo-seccao">Sinais de alerta (§7.1)</h2>${(() => { const semDep = A.filter(x => x.t.startsWith("Sem departamento")).length, semData = A.filter(x => x.t.startsWith("Sem data")).length; return semDep || semData ? `<div class="caixa-info" style="margin-bottom:12px"><p>${semDep ? `<a href="#/actividades?dept=_sem">${semDep} actividade${semDep > 1 ? "s" : ""} sem departamento responsável</a>` : ""}${semDep && semData ? " · " : ""}${semData ? `${semData} sem data definida` : ""}. Sem data, os prazos das fases não podem ser controlados.</p></div>` : ""; })()}${A.filter(x => x.s !== "baixa").length ? A.filter(x => x.s !== "baixa").map(x => `<div class="ind"><span><b>${esc(x.t)}</b></span><small><a href="#/a/${x.a.id}">${esc(x.a.titulo)}</a>${x.d ? " · " + esc(x.d) : ""}</small><span class="rot ${x.s === "alta" ? "rot-erro" : x.s === "média" ? "rot-atraso" : "rot-cinza"}">${x.s}</span></div>`).join("") : `<div class="vazio">Sem sinais de alerta.</div>`}</aside></div>`;
  }

  // ---------- Publicações ----------
  let sepPub = "todas";
  function pgPublicacoes() {
    if (!podePublicacoes()) return `<div class="vazio">Área do Departamento de Comunicação e da Direcção.</div>`;
    if (!S.pubs) { carregarPublicacoes().then(desenhar).catch(e => aviso(mensagemErro(e), "erro")); return `<div class="carregar">A carregar publicações…</div>`; }
    const sep = { todas: "Todas", rascunho: "Rascunhos", submetida: "Para aprovação", publicada: "Publicadas", arquivada: "Arquivadas" };
    const L = S.pubs.filter(p => sepPub === "todas" || p.estado === sepPub);
    return `<div class="cabeca-pagina"><div><h1>Publicações do site</h1><p>Notícias, eventos, oportunidades e o Jornal da Semana. ${exigeAprovacao() ? "O Departamento de Comunicação prepara; o Presidente ou a Vice-Presidente aprovam antes de sair no site (§6.8)." : "Publicação directa activada."}</p></div><div class="accoes"><a class="btn" href="index.html" target="_blank" rel="noopener">Ver site público</a><a class="btn btn-pri" href="#/publicacoes/nova">Nova publicação</a></div></div>
    <nav class="separadores">${Object.entries(sep).map(([k, l]) => `<a href="#" data-sep="${k}" aria-current="${sepPub === k}">${l} (${k === "todas" ? S.pubs.length : S.pubs.filter(p => p.estado === k).length})</a>`).join("")}</nav>
    ${L.length ? `<div class="tabela-env"><table><thead><tr><th>Título</th><th>Categoria</th><th>Situação</th><th>Autor</th><th>Actualizada</th></tr></thead><tbody>${L.map(p => `<tr class="clicavel" data-ir="#/publicacoes/${p.id}"><td><a href="#/publicacoes/${p.id}">${esc(p.titulo)}</a>${p.destaque ? ` <span class="etiqueta">Destaque</span>` : ""}${p.nota_revisao && p.estado === "rascunho" ? `<br><small style="color:var(--atraso)">Devolvida: ${esc(p.nota_revisao)}</small>` : ""}</td><td>${esc(CAT[p.categoria])}</td><td><span class="rot ${{ rascunho: "rot-cinza", submetida: "rot-atraso", publicada: "rot-verde", arquivada: "rot-cinza" }[p.estado]}">${EST_PUB[p.estado]}</span></td><td>${esc(nome(p.autor))}</td><td>${esc(fCarimbo(p.actualizado_em))}</td></tr>`).join("")}</tbody></table></div>` : `<div class="vazio">Sem publicações aqui. <a href="#/publicacoes/nova">Criar publicação</a></div>`}`;
  }
  function pgFormPublicacao(id) {
    if (!podePublicacoes()) return `<div class="vazio">Sem acesso.</div>`;
    if (!S.pubs) { carregarPublicacoes().then(desenhar); return `<div class="carregar">A carregar…</div>`; }
    const p = id ? S.pubs.find(x => x.id === id) : null;
    if (id && !p) return `<div class="vazio">Publicação não encontrada.</div>`;
    const v = p || { categoria: "noticia", estado: "rascunho" };
    const dtLocal = iso => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
    const pub = v.estado === "publicada";
    const pode = !pub || eDireccao() || !exigeAprovacao();
    const bot = [];
    if (eDireccao() || !exigeAprovacao()) { bot.push(`<button class="btn btn-pri" type="submit" value="publicada">${pub ? "Guardar (fica publicada)" : v.estado === "submetida" ? "Aprovar e publicar" : "Publicar"}</button>`); }
    else if (pub) bot.push(`<button class="btn btn-pri" type="submit" value="submetida">Guardar e enviar para nova aprovação</button>`);
    else bot.push(`<button class="btn btn-pri" type="submit" value="submetida">${v.estado === "submetida" ? "Guardar (continua para aprovação)" : "Enviar para aprovação"}</button>`);
    if (!pub) bot.unshift(`<button class="btn" type="submit" value="rascunho">Guardar rascunho</button>`);
    return `<p style="margin:0 0 12px"><a href="#/publicacoes" class="nota-pe">← Publicações</a></p>
    <div class="cabeca-pagina"><div><h1>${p ? "Editar publicação" : "Nova publicação"}</h1><p>${p ? `${EST_PUB[v.estado]} · criada por ${esc(nome(v.autor))}${v.aprovado_por ? " · aprovada por " + esc(nome(v.aprovado_por)) : ""}` : "Prepare o texto, a imagem e a ligação. Pode guardar como rascunho e continuar depois."}</p></div>
      ${p && eDireccao() ? `<div class="accoes">${v.estado === "submetida" ? `<button class="btn" type="button" id="devolver">Devolver com observações</button>` : ""}${pub ? `<button class="btn" type="button" id="arquivar">Retirar do site</button>` : ""}<button class="btn btn-perigo" type="button" id="apagar-pub">Eliminar</button></div>` : (p && !pub ? `<div class="accoes"><button class="btn btn-perigo" type="button" id="apagar-pub">Eliminar</button></div>` : "")}</div>
    ${v.nota_revisao && v.estado === "rascunho" ? `<div class="caixa-info atraso" style="margin-bottom:18px"><p><b>Devolvida pela Direcção:</b> ${esc(v.nota_revisao)}</p></div>` : ""}
    ${pub && !pode ? `<div class="caixa-info" style="margin-bottom:18px"><p>Esta publicação está no site. Se a alterar, sai do site até ser aprovada de novo.</p></div>` : ""}
    <form class="form" id="form-pub" novalidate style="max-width:860px">
      <div class="campo inteiro"><label for="p-titulo">Título</label><input type="text" id="p-titulo" name="titulo" required maxlength="180" value="${esc(v.titulo || "")}"></div>
      <div class="campo"><label for="p-cat">Categoria</label><select id="p-cat" name="categoria">${Object.entries(CAT).map(([k, l]) => `<option value="${k}" ${v.categoria === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="campo"><span class="rotulo">Página inicial</span><label class="opcoes" style="padding-top:8px"><label><input type="checkbox" name="destaque" ${v.destaque ? "checked" : ""}> Mostrar em destaque</label></label></div>
      <div class="campo inteiro"><label for="p-resumo">Resumo</label><input type="text" id="p-resumo" name="resumo" maxlength="280" value="${esc(v.resumo || "")}"><small>Uma ou duas frases. Aparece nos cartões da página inicial.</small></div>
      <div class="campo inteiro"><label for="p-corpo">Texto</label><textarea id="p-corpo" name="corpo" style="min-height:200px">${esc(v.corpo || "")}</textarea><small>Separe os parágrafos com uma linha em branco. Os endereços web ficam clicáveis.</small></div>
      <div class="campo" data-cat="evento"><label for="p-data">Data e hora do evento</label><input type="datetime-local" id="p-data" name="data_evento" value="${dtLocal(v.data_evento)}"></div>
      <div class="campo" data-cat="evento"><label for="p-local">Local</label><input type="text" id="p-local" name="local" value="${esc(v.local || "")}"></div>
      <div class="campo" data-cat="oportunidade"><label for="p-prazo">Prazo de candidatura</label><input type="date" id="p-prazo" name="prazo" value="${esc(v.prazo || "")}"></div>
      <div class="campo"><label for="p-link">Ligação (opcional)</label><input type="url" id="p-link" name="link_url" placeholder="https://" value="${esc(v.link_url || "")}"><small>Formulário de inscrição, página do evento, etc.</small></div>
      <div class="campo"><label for="p-linkt">Texto do botão da ligação</label><input type="text" id="p-linkt" name="link_texto" placeholder="Ex.: Inscrever equipa" maxlength="40" value="${esc(v.link_texto || "")}"></div>
      <div class="campo"><label for="p-img">Imagem (JPG, PNG ou WebP, até 8 MB)</label><input type="file" id="p-img" accept="image/jpeg,image/png,image/webp">${urlSegura(v.imagem_url) ? `<img class="pre-imagem" src="${esc(v.imagem_url)}" alt=""><label class="opcoes"><label><input type="checkbox" name="tirar_imagem"> Remover imagem</label></label>` : ""}<small>Formato horizontal (16:9) fica melhor.</small></div>
      <div class="campo"><label for="p-pdf">Documento PDF (opcional, ex.: Jornal da Semana)</label><input type="file" id="p-pdf" accept="application/pdf">${urlSegura(v.anexo_url) ? `<a href="${esc(v.anexo_url)}" target="_blank" rel="noopener">Documento actual</a><label class="opcoes"><label><input type="checkbox" name="tirar_pdf"> Remover documento</label></label>` : ""}</div>
      <div class="rodape-form"><a class="btn" href="#/publicacoes">Cancelar</a>${bot.join("")}</div>
    </form>`;
  }
  async function enviarFicheiro(file, pasta) {
    if (file.size > 8 * 1024 * 1024) throw new Error("O ficheiro tem mais de 8 MB. Reduza o tamanho e tente de novo.");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const caminho = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const r = await sb.storage.from("media").upload(caminho, file, { contentType: file.type, upsert: false });
    if (r.error) throw r.error;
    return sb.storage.from("media").getPublicUrl(caminho).data.publicUrl;
  }
  function ligarFormPublicacao(id) {
    const f = $("#form-pub"); if (!f) return;
    const mostrarCampos = () => { const c = $("#p-cat").value; $$("[data-cat]", f).forEach(el => el.hidden = el.dataset.cat !== c); };
    $("#p-cat").addEventListener("change", mostrarCampos); mostrarCampos();
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const estado = e.submitter ? e.submitter.value : "rascunho";
      const fd = new FormData(f);
      const titulo = (fd.get("titulo") || "").trim();
      if (titulo.length < 3) { aviso("Indique o título.", "erro"); return; }
      const link = (fd.get("link_url") || "").trim();
      if (link && !urlSegura(link)) { aviso("A ligação deve começar por https://", "erro"); return; }
      const cat = fd.get("categoria");
      const dados = {
        titulo, categoria: cat, resumo: (fd.get("resumo") || "").trim(), corpo: (fd.get("corpo") || "").trim(),
        destaque: fd.get("destaque") === "on", link_url: link || null, link_texto: (fd.get("link_texto") || "").trim() || null,
        data_evento: cat === "evento" && fd.get("data_evento") ? new Date(fd.get("data_evento")).toISOString() : null,
        local: cat === "evento" ? (fd.get("local") || "").trim() : "", prazo: cat === "oportunidade" ? (fd.get("prazo") || null) : null, estado
      };
      if (estado !== "rascunho") dados.nota_revisao = null;
      $$("button[type=submit]", f).forEach(b => b.disabled = true);
      try {
        const img = $("#p-img").files[0], pdf = $("#p-pdf").files[0];
        if (img) dados.imagem_url = await enviarFicheiro(img, "imagens"); else if (fd.get("tirar_imagem") === "on") dados.imagem_url = null;
        if (pdf) dados.anexo_url = await enviarFicheiro(pdf, "documentos"); else if (fd.get("tirar_pdf") === "on") dados.anexo_url = null;
        if (id) await q(actualizar("publicacoes", id, dados)); else await q(sb.from("publicacoes").insert(dados).select("id").single());
        await carregarPublicacoes();
        aviso(estado === "publicada" ? "Publicado no site." : estado === "submetida" ? "Enviado para aprovação." : "Rascunho guardado.");
        location.hash = "#/publicacoes";
      } catch (er) { aviso(mensagemErro(er), "erro"); $$("button[type=submit]", f).forEach(b => b.disabled = false); }
    });
    const pub = id && S.pubs.find(x => x.id === id);
    const d = $("#devolver"); if (d) d.onclick = () => abrirJanela(`<form class="form"><h2 class="inteiro">Devolver ao autor</h2><div class="campo inteiro"><label for="dv">Observações</label><textarea id="dv" name="nota" required></textarea></div>${rodapeJanela("Devolver")}</form>`,
      async fd => { const n = (fd.get("nota") || "").trim(); if (!n) { aviso("Escreva as observações.", "erro"); return false; } try { await q(actualizar("publicacoes", id, { estado: "rascunho", nota_revisao: n })); await carregarPublicacoes(); aviso("Publicação devolvida."); location.hash = "#/publicacoes"; return true; } catch (e) { aviso(mensagemErro(e), "erro"); return false; } });
    const ar = $("#arquivar"); if (ar) ar.onclick = async () => { try { await q(actualizar("publicacoes", id, { estado: "arquivada", destaque: false })); await carregarPublicacoes(); aviso("Retirada do site."); location.hash = "#/publicacoes"; } catch (e) { aviso(mensagemErro(e), "erro"); } };
    const ap = $("#apagar-pub"); if (ap) ap.onclick = () => abrirJanela(`<form class="form"><h2 class="inteiro">Eliminar «${esc(pub ? pub.titulo : "")}»?</h2><p class="aviso-form inteiro">A publicação é apagada definitivamente.</p>${rodapeJanela("Eliminar", "btn-perigo")}</form>`,
      async () => { try { const r = await sb.from("publicacoes").delete().eq("id", id).select("id"); if (r.error) throw r.error; if (!r.data || !r.data.length) throw new Error("Sem permissão para esta acção."); await carregarPublicacoes(); aviso("Publicação eliminada."); location.hash = "#/publicacoes"; return true; } catch (e) { aviso(mensagemErro(e), "erro"); return false; } });
  }

  // ---------- Administração ----------
  let sepAdmin = "membros";
  function senhaAleatoria() {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; const v = new Uint32Array(10); crypto.getRandomValues(v);
    return "Nefe-" + [...v].map(x => c[x % c.length]).join("");
  }
  async function chamarAdmin(corpo) {
    const r = await sb.functions.invoke("admin-utilizadores", { body: corpo });
    if (r.error) {
      let m = r.error.message || "";
      try { const j = await r.error.context.json(); if (j && j.erro) m = j.erro; } catch (e) { }
      if (/Failed to send|Function not found|404/i.test(m)) m = "A função de administração ainda não foi instalada no Supabase (passo 5 do guia).";
      throw new Error(m);
    }
    if (r.data && r.data.erro) throw new Error(r.data.erro);
    return r.data;
  }
  function pgAdmin() {
    if (!eAdmin()) return `<div class="vazio">Área reservada à Administração.</div>`;
    const sep = { membros: "Membros", nova: "Nova conta", config: "Configurações" };
    let h = `<div class="cabeca-pagina"><div><h1>Administração</h1><p>Contas de acesso, cargos e configurações do site. Só o Presidente, a Vice-Presidente e o Auditor Interno vêem esta área.</p></div></div>
      <nav class="separadores">${Object.entries(sep).map(([k, l]) => `<a href="#" data-sep-admin="${k}" aria-current="${sepAdmin === k}">${l}</a>`).join("")}</nav>`;
    if (sepAdmin === "membros") {
      const P = [...S.perfis.values()].sort((a, b) => (b.activo - a.activo) || ["presidente", "vice", "auditor", "chefe", "membro"].indexOf(a.cargo) - ["presidente", "vice", "auditor", "chefe", "membro"].indexOf(b.cargo) || (a.departamento || "").localeCompare(b.departamento || ""));
      h += `<div class="tabela-env"><table><thead><tr><th>Nome</th><th>Email</th><th>Cargo</th><th>Departamento</th><th>Situação</th><th></th></tr></thead><tbody>${P.map(p => `<tr><td>${esc(p.nome)}${p.id === eu().id ? " <span class='nota-pe'>(você)</span>" : ""}</td><td>${esc(p.email)}</td><td>${esc(CARGOS[p.cargo])}</td><td>${["chefe", "membro"].includes(p.cargo) ? esc(curtoDept(p.departamento)) : "—"}</td><td>${p.activo ? (p.trocar_senha ? `<span class="rot rot-atraso">Senha temporária</span>` : `<span class="rot rot-verde">Activa</span>`) : `<span class="rot rot-cinza">Desactivada</span>`}</td><td style="white-space:nowrap;text-align:right"><button class="btn btn-peq" data-editar-perfil="${p.id}">Editar</button> <button class="btn btn-peq" data-senha="${p.id}">Repor senha</button>${p.id !== eu().id ? ` <button class="btn btn-peq ${p.activo ? "btn-perigo" : ""}" data-estado="${p.id}">${p.activo ? "Desactivar" : "Reactivar"}</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
      <p class="nota-pe">Quando alguém sai do NEFE, desactive a conta em vez de a apagar: o histórico continua com o nome da pessoa.</p>`;
    } else if (sepAdmin === "nova") {
      h += `<form class="form" id="form-conta" style="max-width:760px" novalidate>
        <div class="campo"><label for="u-nome">Nome completo</label><input type="text" id="u-nome" name="nome" required></div>
        <div class="campo"><label for="u-email">Email</label><input type="email" id="u-email" name="email" required autocomplete="off"></div>
        <div class="campo"><label for="u-cargo">Cargo</label><select id="u-cargo" name="cargo">${Object.entries(CARGOS).map(([k, l]) => `<option value="${k}" ${k === "chefe" ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="campo" id="u-dept-campo"><label for="u-dept">Departamento</label><select id="u-dept" name="departamento">${DEPTS_OPERATIVOS.map(c => `<option value="${c}">${esc(nomeDept(c))}</option>`).join("")}</select></div>
        <div class="campo"><label for="u-senha">Senha temporária</label><input type="text" id="u-senha" name="senha" value="${senhaAleatoria()}" autocomplete="off"><small>A pessoa muda a senha no primeiro acesso.</small></div>
        <p class="nota-pe inteiro" style="margin:0"><b>Chefe</b>: regista e gere as actividades do departamento. <b>Membro</b>: vê as actividades do departamento, marca passos e tarefas, mas não cria, conclui nem cancela.</p>
        <div class="rodape-form"><button class="btn btn-pri" type="submit">Criar conta</button></div></form><div id="credenciais"></div>`;
    } else {
      const c = S.cfg.contactos || {};
      h += `<form class="form" id="form-config" style="max-width:860px" novalidate>
        <div class="campo"><label for="c-sem">Semestre actual</label><input type="text" id="c-sem" name="semestre" value="${esc(semestreActual())}" pattern="(I|II)-20[0-9]{2}"><small>Formato: I-2027 ou II-2027. As actividades novas ficam neste semestre.</small></div>
        <div class="campo"><span class="rotulo">Publicações</span><label class="opcoes" style="padding-top:8px"><label><input type="checkbox" name="aprovacao" ${exigeAprovacao() ? "checked" : ""}> Exigir aprovação do Presidente ou da Vice-Presidente</label></label></div>
        <div class="campo inteiro"><label for="c-sobre">Texto «Sobre o NEFE» (site público)</label><textarea id="c-sobre" name="sobre">${esc(S.cfg.sobre || "")}</textarea></div>
        <div class="campo"><label for="c-email">Email de contacto</label><input type="email" id="c-email" name="email" value="${esc(c.email || "")}"></div>
        <div class="campo"><label for="c-tel">Telefone</label><input type="text" id="c-tel" name="telefone" value="${esc(c.telefone || "")}"></div>
        <div class="campo inteiro"><label for="c-morada">Morada</label><input type="text" id="c-morada" name="morada" value="${esc(c.morada || "")}"></div>
        <div class="campo"><label for="c-fb">Facebook (endereço)</label><input type="url" id="c-fb" name="facebook" placeholder="https://" value="${esc(c.facebook || "")}"></div>
        <div class="campo"><label for="c-ig">Instagram (endereço)</label><input type="url" id="c-ig" name="instagram" placeholder="https://" value="${esc(c.instagram || "")}"></div>
        <div class="rodape-form"><button class="btn btn-pri" type="submit">Guardar configurações</button></div></form>`;
    }
    return h;
  }
  function ligarAdmin() {
    $$("[data-sep-admin]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); sepAdmin = a.dataset.sepAdmin; desenhar(); }));
    const fc = $("#form-conta");
    if (fc) {
      const cg = $("#u-cargo"), mostrar = () => { $("#u-dept-campo").hidden = !["chefe", "membro"].includes(cg.value); }; cg.addEventListener("change", mostrar); mostrar();
      fc.addEventListener("submit", async e => {
        e.preventDefault(); const fd = new FormData(fc); const b = $("button[type=submit]", fc); b.disabled = true;
        const corpo = { accao: "criar", nome: (fd.get("nome") || "").trim(), email: (fd.get("email") || "").trim(), cargo: fd.get("cargo"), departamento: fd.get("departamento"), senha: fd.get("senha") };
        try {
          await chamarAdmin(corpo);
          await recarregarPerfis();
          $("#credenciais").innerHTML = `<div class="caixa" style="margin-top:22px;max-width:760px"><h2 class="titulo-seccao">Conta criada</h2><p style="margin:0 0 10px">Envie estes dados à pessoa por um canal privado (WhatsApp ou pessoalmente):</p><div class="credenciais" id="cred-texto">Site: ${esc(location.origin + location.pathname.replace(/membros\.html$/, "entrar.html"))}\nEmail: ${esc(corpo.email)}\nSenha temporária: ${esc(corpo.senha)}</div><p style="margin:10px 0 0"><button class="btn btn-peq" id="copiar-cred" type="button">Copiar</button></p></div>`;
          $("#copiar-cred").onclick = async () => { try { await navigator.clipboard.writeText($("#cred-texto").textContent); aviso("Copiado."); } catch (er) { aviso("Seleccione o texto e copie."); } };
          fc.reset(); $("#u-senha").value = senhaAleatoria(); mostrar(); aviso("Conta criada.");
        } catch (er) { aviso(mensagemErro(er), "erro"); }
        b.disabled = false;
      });
    }
    $$("[data-editar-perfil]").forEach(bt => bt.addEventListener("click", () => {
      const p = S.perfis.get(bt.dataset.editarPerfil); const proprio = p.id === eu().id;
      abrirJanela(`<form class="form"><h2 class="inteiro">Editar ${esc(p.nome)}</h2>
        <div class="campo inteiro"><label for="e-nome">Nome</label><input type="text" id="e-nome" name="nome" value="${esc(p.nome)}" required></div>
        <div class="campo"><label for="e-cargo">Cargo</label><select id="e-cargo" name="cargo" ${proprio ? "disabled" : ""}>${Object.entries(CARGOS).map(([k, l]) => `<option value="${k}" ${p.cargo === k ? "selected" : ""}>${l}</option>`).join("")}</select>${proprio ? "<small>Outro administrador muda o seu cargo.</small>" : ""}</div>
        <div class="campo"><label for="e-dept">Departamento (chefes e membros)</label><select id="e-dept" name="departamento">${DEPTS_OPERATIVOS.map(c => `<option value="${c}" ${p.departamento === c ? "selected" : ""}>${esc(curtoDept(c))}</option>`).join("")}</select></div>${rodapeJanela("Guardar")}</form>`,
        async fd => {
          const v = { nome: (fd.get("nome") || "").trim() };
          if (!proprio) { v.cargo = fd.get("cargo"); if (["chefe", "membro"].includes(v.cargo)) v.departamento = fd.get("departamento"); }
          try { await q(actualizar("perfis", p.id, v)); await recarregarPerfis(); aviso("Perfil actualizado."); desenhar(); return true; } catch (e) { aviso(mensagemErro(e), "erro"); return false; }
        });
    }));
    $$("[data-senha]").forEach(bt => bt.addEventListener("click", () => {
      const p = S.perfis.get(bt.dataset.senha), s = senhaAleatoria();
      abrirJanela(`<form class="form"><h2 class="inteiro">Repor a senha de ${esc(p.nome)}</h2><div class="campo inteiro"><label for="rs">Nova senha temporária</label><input type="text" id="rs" name="senha" value="${s}"></div><p class="nota-pe inteiro">Envie a senha à pessoa por um canal privado. Ela será pedida para a mudar ao entrar.</p>${rodapeJanela("Repor senha")}</form>`,
        async fd => { try { await chamarAdmin({ accao: "senha", id: p.id, senha: fd.get("senha") }); await recarregarPerfis(); aviso("Senha reposta: " + fd.get("senha")); desenhar(); return true; } catch (e) { aviso(mensagemErro(e), "erro"); return false; } });
    }));
    $$("[data-estado]").forEach(bt => bt.addEventListener("click", () => {
      const p = S.perfis.get(bt.dataset.estado);
      abrirJanela(`<form class="form"><h2 class="inteiro">${p.activo ? "Desactivar" : "Reactivar"} a conta de ${esc(p.nome)}?</h2><p class="nota-pe inteiro">${p.activo ? "A pessoa deixa de conseguir entrar. O histórico mantém-se." : "A pessoa volta a conseguir entrar com a senha que tinha."}</p>${rodapeJanela(p.activo ? "Desactivar" : "Reactivar", p.activo ? "btn-perigo" : "btn-pri")}</form>`,
        async () => { try { await chamarAdmin({ accao: "estado", id: p.id, activo: !p.activo }); await recarregarPerfis(); aviso(p.activo ? "Conta desactivada." : "Conta reactivada."); desenhar(); return true; } catch (e) { aviso(mensagemErro(e), "erro"); return false; } });
    }));
    const fg = $("#form-config");
    if (fg) fg.addEventListener("submit", async e => {
      e.preventDefault(); const fd = new FormData(fg);
      const sem = (fd.get("semestre") || "").trim().toUpperCase();
      if (!/^(I|II)-20\d{2}$/.test(sem)) { aviso("Semestre no formato I-2027 ou II-2027.", "erro"); return; }
      for (const k of ["facebook", "instagram"]) { const u = (fd.get(k) || "").trim(); if (u && !urlSegura(u)) { aviso("O endereço do " + k + " deve começar por https://", "erro"); return; } }
      const linhas = [
        { chave: "semestre_actual", valor: sem },
        { chave: "publicacoes_exigem_aprovacao", valor: fd.get("aprovacao") === "on" },
        { chave: "sobre", valor: (fd.get("sobre") || "").trim() },
        { chave: "contactos", valor: { email: (fd.get("email") || "").trim(), telefone: (fd.get("telefone") || "").trim(), morada: (fd.get("morada") || "").trim(), facebook: (fd.get("facebook") || "").trim(), instagram: (fd.get("instagram") || "").trim() } }
      ];
      try { await q(sb.from("configuracoes").upsert(linhas, { onConflict: "chave" })); linhas.forEach(l => S.cfg[l.chave] = l.valor); filtros.sem = sem; guardaFiltros(); aviso("Configurações guardadas."); desenhar(); }
      catch (er) { aviso(mensagemErro(er), "erro"); }
    });
  }
  async function recarregarPerfis() {
    const perfis = await q(sb.from("perfis").select("id,nome,email,cargo,departamento,activo,trocar_senha,criado_em").order("nome"));
    S.perfis = new Map(perfis.map(p => [p.id, p])); S.eu = S.perfis.get(eu().id) || S.eu;
  }

  // ---------- A minha conta ----------
  function pgConta() {
    const e = eu();
    return `<div class="cabeca-pagina"><div><h1>A minha conta</h1><p>${esc(e.nome)} · ${esc(e.email)} · ${esc(CARGOS[e.cargo])}${["chefe", "membro"].includes(e.cargo) ? " · " + esc(nomeDept(e.departamento)) : ""}</p></div></div>
    ${e.trocar_senha ? `<div class="caixa-info atraso" style="margin-bottom:20px"><p><b>Está a usar uma senha temporária.</b> Escolha uma senha pessoal que só você conheça.</p></div>` : ""}
    <form class="form" id="form-senha" style="max-width:520px" novalidate><h2 class="titulo-seccao inteiro">Mudar senha</h2>
      <div class="campo inteiro"><label for="s1">Nova senha</label><input type="password" id="s1" autocomplete="new-password" minlength="8" required><small>Pelo menos 8 caracteres.</small></div>
      <div class="campo inteiro"><label for="s2">Repetir a nova senha</label><input type="password" id="s2" autocomplete="new-password" required></div>
      <div class="rodape-form"><button class="btn btn-pri" type="submit">Guardar nova senha</button></div></form>`;
  }
  function ligarConta() {
    const f = $("#form-senha"); if (!f) return;
    f.addEventListener("submit", async e => {
      e.preventDefault(); const s1 = $("#s1").value, s2 = $("#s2").value;
      if (s1.length < 8) { aviso("A senha deve ter pelo menos 8 caracteres.", "erro"); return; }
      if (s1 !== s2) { aviso("As duas senhas não coincidem.", "erro"); return; }
      try {
        const r = await sb.auth.updateUser({ password: s1 }); if (r.error) throw r.error;
        await q(actualizar("perfis", eu().id, { trocar_senha: false })); S.eu.trocar_senha = false;
        f.reset(); aviso("Senha alterada."); location.hash = "#/";
      } catch (er) { aviso(mensagemErro(er), "erro"); }
    });
  }

  // ------------------------------------------------------------------
  // Navegação
  // ------------------------------------------------------------------
  function desenhar() {
    if (!S.pronto) return;
    const h = (location.hash || "#/").replace(/^#\/?/, "").split("?")[0];
    const p = h.split("/").map(decodeURIComponent);
    const r = p[0] || "";
    desenharCabecalho(r === "a" ? "actividades" : r === "nova" ? "actividades" : r);
    const el = $("#conteudo");
    let html, ligar = null;
    if (r === "" ) html = pgPainel();
    else if (r === "actividades") {
      const d = new URLSearchParams(location.hash.split("?")[1] || "").get("dept");
      if (d !== null) { filtros.dept = d; filtros.estado = ""; guardaFiltros(); history.replaceState(null, "", "#/actividades"); }
      html = pgActividades(); ligar = ligarFiltros;
    }
    else if (r === "nova") { html = pgFormActividade(null); ligar = () => ligarFormActividade(null); }
    else if (r === "a" && p[2] === "editar") { html = pgFormActividade(p[1]); ligar = () => ligarFormActividade(p[1]); }
    else if (r === "a") {
      html = pgFicha(p[1]); ligar = () => ligarFicha(p[1]);
      if (S.ficha.id !== p[1] && S.acts.get(p[1])) { S.ficha = { id: p[1], hist: [], tarefas: [] }; carregarFicha(p[1]).then(() => { if (location.hash.startsWith("#/a/" + p[1])) desenhar(); }).catch(() => { }); }
    }
    else if (r === "d") html = pgDepartamento(p[1]);
    else if (r === "auditoria") html = pgAuditoria();
    else if (r === "publicacoes" && p[1]) { html = pgFormPublicacao(p[1] === "nova" ? null : p[1]); ligar = () => ligarFormPublicacao(p[1] === "nova" ? null : p[1]); }
    else if (r === "publicacoes") { html = pgPublicacoes(); ligar = () => $$("[data-sep]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); sepPub = a.dataset.sep; desenhar(); })); }
    else if (r === "admin") { html = pgAdmin(); ligar = ligarAdmin; }
    else if (r === "conta") { html = pgConta(); ligar = ligarConta; }
    else html = `<div class="vazio">Página não encontrada. <a href="#/">Painel</a></div>`;
    el.innerHTML = html;
    $$("tr[data-ir]", el).forEach(tr => tr.addEventListener("click", e => { if (!e.target.closest("a,button")) location.hash = tr.dataset.ir; }));
    if (ligar) ligar();
  }
  let ultimaRota = "";
  window.addEventListener("hashchange", () => {
    $("#painel-dep").hidden = true;
    const r = location.hash.split("?")[0];
    if (r !== ultimaRota) { ultimaRota = r; window.scrollTo(0, 0); }
    desenhar();
  });
  // actualiza quando a pessoa volta ao separador (dados de outros membros)
  let ultimaCarga = Date.now();
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !S.pronto || Date.now() - ultimaCarga < 60000) return;
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    ultimaCarga = Date.now();
    try { await carregarActividades(); if (S.pubs) await carregarPublicacoes(); if (S.ficha.id) await carregarFicha(S.ficha.id); if (!$("#form-act") && !$("#form-pub") && $("#janela").hidden) desenhar(); } catch (e) { }
  });
  $("#sair").addEventListener("click", async () => { await sb.auth.signOut(); location.replace("entrar.html?m=saiu"); });
  sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") location.replace("entrar.html"); });

  NEFE.rodape();
  (async () => {
    try {
      const ok = await carregarBase(); if (!ok) return;
      if (eDireccao() || eCom()) carregarPublicacoes().then(() => { if (S.pronto) desenharCabecalho((location.hash.replace(/^#\/?/, "").split("/")[0]) || ""); }).catch(() => { });
      S.pronto = true; ultimaRota = location.hash.split("?")[0];
      if (eu().trocar_senha && !location.hash.startsWith("#/conta")) location.hash = "#/conta";
      desenhar();
    } catch (e) {
      $("#conteudo").innerHTML = `<div class="caixa-info erro"><p>Não foi possível carregar os dados: ${esc(mensagemErro(e))}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
    }
  })();
})();
