// NEFE-UEM · site público (sem login)
"use strict";
(() => {
  const { sb, esc, $, $$, fData, fCurta, fEvento, hoje, dia, urlSegura, paragrafos, MESES, MESES_L } = NEFE;
  const CAT = { noticia: "Notícia", evento: "Evento", oportunidade: "Oportunidade", jornal: "Jornal da Semana", comunicado: "Comunicado" };
  const S = { pubs: [], agenda: [], depts: [], sobre: "", contactos: {}, pronto: false, demo: !NEFE.configurado, falha: false };

  // ---------------- Dados ----------------
  async function carregar() {
    if (S.demo) { exemplos(); return; }
    try {
      const limite = new Promise((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), 15000));
      const [p, a, d, c] = await Promise.race([limite, Promise.all([
        sb.from("publicacoes").select("id,titulo,resumo,corpo,categoria,imagem_url,anexo_url,link_url,link_texto,data_evento,local,prazo,destaque,publicado_em").eq("estado", "publicada").order("publicado_em", { ascending: false }).limit(300),
        sb.rpc("agenda_publica"),
        sb.from("departamentos").select("codigo,nome,descricao,ordem").order("ordem"),
        sb.from("configuracoes").select("chave,valor").in("chave", ["sobre", "contactos"])
      ])]);
      if (p.error) throw p.error;
      S.pubs = p.data || [];
      S.agenda = a.data || [];
      S.depts = d.data || [];
      (c.data || []).forEach(r => { if (r.chave === "sobre") S.sobre = r.valor; if (r.chave === "contactos") S.contactos = r.valor || {}; });
    } catch (e) {
      S.falha = true;
    }
  }

  function exemplos() {
    $("#banda-demo").hidden = false;
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); x.setHours(15, 0, 0, 0); return x.toISOString(); };
    const iso = n => d(n).slice(0, 10);
    S.pubs = [
      { id: "ex1", categoria: "evento", destaque: true, titulo: "Exemplo: Torneio de futsal inter-cursos", resumo: "Inscrições abertas para equipas masculinas e femininas de todos os cursos da Faculdade de Economia.", corpo: "As equipas inscrevem-se até uma semana antes do início.\n\nO regulamento, os horários e a arbitragem são divulgados antes do primeiro jogo.", data_evento: d(12), local: "Campo da UEM", link_url: "https://example.org/inscricao", link_texto: "Inscrever equipa", publicado_em: d(-1) },
      { id: "ex2", categoria: "evento", titulo: "Exemplo: Campeonato de xadrez", resumo: "Torneio aberto a todos os estudantes, em sistema suíço.", corpo: "Traga o seu cartão de estudante.", data_evento: d(19), local: "Faculdade de Economia, Sala 12", publicado_em: d(-2) },
      { id: "ex3", categoria: "oportunidade", titulo: "Exemplo: Estágios de verão em instituições financeiras", resumo: "Candidaturas para estudantes do 3.º e 4.º ano.", corpo: "Envie o CV e a carta de motivação.", prazo: iso(9), link_url: "https://example.org", link_texto: "Candidatar", publicado_em: d(-3) },
      { id: "ex4", categoria: "noticia", titulo: "Exemplo: NEFE apresenta o Plano do II Semestre", resumo: "Palestras, workshops, acções solidárias e a NEFE Week marcam o semestre.", corpo: "O Plano Semestral reúne as actividades de todos os departamentos.", publicado_em: d(-4) },
      { id: "ex5", categoria: "jornal", titulo: "Exemplo: Jornal da Semana", resumo: "Resumo das actividades da semana e agenda dos próximos dias.", corpo: "Edição semanal do NEFE.", publicado_em: d(-5) },
      { id: "ex6", categoria: "comunicado", titulo: "Exemplo: Horário de atendimento do NEFE", resumo: "O gabinete atende os estudantes de segunda a sexta-feira.", corpo: "", publicado_em: d(-6) }
    ];
    S.agenda = [{ id: "a1", titulo: "Exemplo: Outubro Rosa", data: iso(4), mes: null, local: "Faculdade de Economia", resumo: "Rastreio e sessão de zumba.", departamento: "Departamento da Inclusão e Bem-Estar Estudantil", estado: "activa" }];
    S.sobre = "O Núcleo de Estudantes da Faculdade de Economia (NEFE) representa os estudantes da Faculdade de Economia da Universidade Eduardo Mondlane e organiza actividades académicas, profissionais, culturais, desportivas e solidárias ao longo do ano.";
    S.depts = [{ codigo: "acad", nome: "Departamento Académico e Científico", descricao: "Actividades académicas e científicas." }];
  }

  // ---------------- Auxiliares de apresentação ----------------
  const img = (p, cls) => { const u = urlSegura(p.imagem_url); return u ? `<img src="${esc(u)}" alt="" loading="lazy"${cls ? ` class="${cls}"` : ""}>` : `<img class="emblema" src="assets/img/emblema-nefe.png" alt="">`; };
  const dataPub = p => p.categoria === "evento" && p.data_evento ? fEvento(p.data_evento) : fData(p.publicado_em);
  const ligacao = p => `#/p/${encodeURIComponent(p.id)}`;
  function cartao(p) {
    return `<a class="cartao" href="${ligacao(p)}"><div class="imagem">${img(p)}</div><div class="corpo"><span class="categoria">${esc(CAT[p.categoria] || "")}</span><h3>${esc(p.titulo)}</h3><span class="data">${esc(dataPub(p))}</span></div></a>`;
  }
  function blocoDia(d) {
    return d ? `<div class="dia"><b>${d.getDate()}</b><span>${MESES[d.getMonth()]}</span></div>` : `<div class="dia sem"><b>—</b><span>data</span></div>`;
  }
  // eventos publicados + actividades marcadas como públicas, numa só agenda
  function agendaCompleta() {
    const ev = S.pubs.filter(p => p.categoria === "evento").map(p => ({ tipo: "pub", id: p.id, titulo: p.titulo, quando: p.data_evento ? new Date(p.data_evento) : null, iso: p.data_evento, local: p.local, texto: p.resumo }));
    const ac = S.agenda.map(a => ({ tipo: "act", id: a.id, titulo: a.titulo, quando: a.data ? dia(a.data) : null, mes: a.mes, local: a.local, texto: a.resumo || a.departamento, estado: a.estado }));
    return ev.concat(ac);
  }
  function linhaEvento(e) {
    const href = e.tipo === "pub" ? `#/p/${encodeURIComponent(e.id)}` : `#/agenda`;
    const quando = e.quando ? (e.tipo === "pub" ? fEvento(e.iso) : fData(e.quando)) : (e.mes ? MESES_L[e.mes - 1] : "Data a anunciar");
    return `<a class="evento" href="${href}">${blocoDia(e.quando)}<div><h3>${esc(e.titulo)}</h3><p>${esc(quando)}${e.local ? " · " + esc(e.local) : ""}</p>${e.texto ? `<p>${esc(e.texto)}</p>` : ""}</div></a>`;
  }
  function prazoTexto(p) {
    if (!p.prazo) return "Sem prazo indicado";
    const d = dia(p.prazo);
    return d < hoje() ? "Prazo encerrado a " + fData(d) : "Candidaturas até " + fData(d);
  }
  function linhaOportunidade(p) {
    return `<a class="oportunidade" href="${ligacao(p)}"><h3>${esc(p.titulo)}</h3><p>${esc(prazoTexto(p))}${p.resumo ? " · " + esc(p.resumo) : ""}</p></a>`;
  }
  function erroCarga() {
    return `<div class="caixa-info erro"><p>Não foi possível carregar os conteúdos. Verifique a ligação à internet e recarregue a página.</p></div>`;
  }

  // ---------------- Páginas ----------------
  function inicio() {
    if (S.falha) return erroCarga();
    const P = S.pubs;
    const dest = P.find(p => p.destaque) || P.find(p => ["noticia", "evento", "comunicado"].includes(p.categoria));
    let h = "";
    if (dest) {
      const u = urlSegura(dest.imagem_url);
      h += `<section class="destaque ${u ? "" : "sem-imagem"}" aria-label="Destaque">${u ? `<div class="imagem"><img src="${esc(u)}" alt=""></div>` : ""}<div class="texto"><span class="categoria">${esc(CAT[dest.categoria])}</span><h2>${esc(dest.titulo)}</h2>${dest.categoria === "evento" && dest.data_evento ? `<p><b>${esc(fEvento(dest.data_evento))}</b>${dest.local ? " · " + esc(dest.local) : ""}</p>` : ""}${dest.resumo ? `<p>${esc(dest.resumo)}</p>` : ""}<div class="accoes"><a class="btn btn-pri" href="${ligacao(dest)}">Saber mais</a>${urlSegura(dest.link_url) ? `<a class="btn" href="${esc(urlSegura(dest.link_url))}" target="_blank" rel="noopener">${esc(dest.link_texto || "Abrir ligação")}</a>` : ""}</div></div></section>`;
    } else {
      h += `<section class="caixa-info"><p><b>Bem-vindo ao site do NEFE.</b> As notícias, eventos e oportunidades do Núcleo aparecem aqui assim que forem publicados.</p></section>`;
    }
    const noticias = P.filter(p => p !== dest && ["noticia", "comunicado", "evento"].includes(p.categoria)).slice(0, 6);
    const prox = agendaCompleta().filter(e => !e.quando || e.quando >= hoje()).sort((a, b) => (a.quando ? a.quando.getTime() : 9e15) - (b.quando ? b.quando.getTime() : 9e15)).slice(0, 5);
    const oport = P.filter(p => p.categoria === "oportunidade" && (!p.prazo || dia(p.prazo) >= hoje())).slice(0, 4);
    const jornal = P.find(p => p.categoria === "jornal");
    h += `<div class="grelha g-2-1" style="margin-top:32px">
      <section><h2 class="titulo-seccao">Últimas publicações <a href="#/noticias">Ver todas</a></h2>${noticias.length ? `<div class="cartoes c2">${noticias.map(cartao).join("")}</div>` : `<div class="vazio">Ainda não há publicações.</div>`}</section>
      <aside class="grelha" style="gap:30px;align-content:start">
        <section><h2 class="titulo-seccao">Próximos eventos <a href="#/agenda">Agenda</a></h2>${prox.length ? `<div class="lista-eventos">${prox.map(linhaEvento).join("")}</div>` : `<div class="vazio">Sem eventos marcados.</div>`}</section>
        <section><h2 class="titulo-seccao">Oportunidades <a href="#/oportunidades">Ver todas</a></h2>${oport.length ? oport.map(linhaOportunidade).join("") : `<div class="vazio">Sem oportunidades abertas.</div>`}</section>
        <section><h2 class="titulo-seccao">Jornal da Semana <a href="#/jornal">Arquivo</a></h2>${jornal ? `<a class="jornal" href="${ligacao(jornal)}" style="text-decoration:none;color:inherit"><div class="capa">JORNAL DA SEMANA</div><div><h3 style="font-size:15.5px">${esc(jornal.titulo)}</h3><p class="nota-pe" style="margin:4px 0 0">${esc(fData(jornal.publicado_em))}</p>${jornal.resumo ? `<p style="margin:6px 0 0;font-size:14px">${esc(jornal.resumo)}</p>` : ""}</div></a>` : `<div class="vazio">A primeira edição sai em breve.</div>`}</section>
      </aside></div>`;
    return h;
  }

  function noticias(cat) {
    if (S.falha) return erroCarga();
    const filtros = [["", "Todas"], ["noticia", "Notícias"], ["evento", "Eventos"], ["oportunidade", "Oportunidades"], ["comunicado", "Comunicados"], ["jornal", "Jornal da Semana"]];
    const L = S.pubs.filter(p => !cat || p.categoria === cat);
    return `<div class="cabeca-pagina"><div><h1>Notícias e publicações</h1><p>Tudo o que o NEFE publicou, do mais recente para o mais antigo.</p></div></div>
      <nav class="filtros-cat" aria-label="Categorias">${filtros.map(([k, l]) => `<a href="#/noticias${k ? "/" + k : ""}" aria-current="${(cat || "") === k}">${l}</a>`).join("")}</nav>
      ${L.length ? `<div class="cartoes">${L.map(cartao).join("")}</div>` : `<div class="vazio">Não há publicações nesta categoria.</div>`}`;
  }

  function agenda() {
    if (S.falha) return erroCarga();
    const A = agendaCompleta();
    const ord = (a, b) => (a.quando ? a.quando.getTime() : 9e15) - (b.quando ? b.quando.getTime() : 9e15);
    const prox = A.filter(e => !e.quando || e.quando >= hoje()).sort(ord);
    const pass = A.filter(e => e.quando && e.quando < hoje()).sort((a, b) => b.quando - a.quando).slice(0, 20);
    return `<div class="cabeca-pagina"><div><h1>Agenda</h1><p>Eventos e actividades do NEFE.</p></div></div>
      <div class="grelha g-1-1">
        <section><h2 class="titulo-seccao">Próximos</h2>${prox.length ? `<div class="lista-eventos">${prox.map(linhaEvento).join("")}</div>` : `<div class="vazio">Sem eventos marcados.</div>`}</section>
        <section><h2 class="titulo-seccao">Realizados</h2>${pass.length ? `<div class="lista-eventos">${pass.map(linhaEvento).join("")}</div>` : `<div class="vazio">Ainda sem eventos realizados.</div>`}</section>
      </div>`;
  }

  function oportunidades() {
    if (S.falha) return erroCarga();
    const O = S.pubs.filter(p => p.categoria === "oportunidade");
    const abertas = O.filter(p => !p.prazo || dia(p.prazo) >= hoje()).sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999"));
    const fechadas = O.filter(p => p.prazo && dia(p.prazo) < hoje());
    return `<div class="cabeca-pagina"><div><h1>Oportunidades</h1><p>Bolsas, estágios, concursos e vagas partilhados pelo NEFE.</p></div></div>
      <div class="grelha g-2-1"><section><h2 class="titulo-seccao">Abertas</h2>${abertas.length ? abertas.map(linhaOportunidade).join("") : `<div class="vazio">Sem oportunidades abertas neste momento.</div>`}</section>
      <section><h2 class="titulo-seccao">Encerradas</h2>${fechadas.length ? fechadas.slice(0, 15).map(linhaOportunidade).join("") : `<div class="vazio">Nada a mostrar.</div>`}</section></div>`;
  }

  function jornal() {
    if (S.falha) return erroCarga();
    const J = S.pubs.filter(p => p.categoria === "jornal");
    return `<div class="cabeca-pagina"><div><h1>Jornal da Semana</h1><p>As edições semanais do NEFE.</p></div></div>
      ${J.length ? `<div class="grelha g-1-1">${J.map(j => `<a class="jornal caixa" href="${ligacao(j)}" style="text-decoration:none;color:inherit"><div class="capa">JORNAL DA SEMANA</div><div><span class="categoria">${esc(fData(j.publicado_em))}</span><h3 style="font-size:16px;margin-top:4px">${esc(j.titulo)}</h3>${j.resumo ? `<p style="margin:6px 0 0;font-size:14px;color:var(--texto2)">${esc(j.resumo)}</p>` : ""}</div></a>`).join("")}</div>` : `<div class="vazio">Ainda não há edições publicadas.</div>`}`;
  }

  function sobre() {
    const c = S.contactos || {};
    const linhas = [["Email", c.email], ["Telefone", c.telefone], ["Morada", c.morada]].filter(x => x[1]);
    const redes = [["Facebook", c.facebook], ["Instagram", c.instagram]].filter(x => urlSegura(x[1]));
    return `<div class="cabeca-pagina"><div><h1>Sobre o NEFE</h1><p>Núcleo de Estudantes da Faculdade de Economia · Universidade Eduardo Mondlane</p></div></div>
      <div class="grelha g-2-1"><section>${NEFE.paragrafos(S.sobre) || `<p>Informação em preparação.</p>`}
        <h2 class="titulo-seccao" style="margin-top:28px">Órgãos e departamentos</h2>
        <dl class="dados">${S.depts.map(d => `<div><dt><b style="color:var(--tinta)">${esc(d.nome)}</b></dt><dd>${esc(d.descricao || "")}</dd></div>`).join("")}</dl></section>
      <aside><h2 class="titulo-seccao">Contactos</h2>${linhas.length || redes.length ? `<dl class="dados">${linhas.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}${redes.map(([k, v]) => `<div><dt>${k}</dt><dd><a href="${esc(urlSegura(v))}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\/(www\.)?/, ""))}</a></dd></div>`).join("")}</dl>` : `<div class="vazio">Contactos por publicar.</div>`}
        <div class="caixa-info" style="margin-top:20px"><p>É membro do NEFE? Entre na área reservada para acompanhar as actividades do seu departamento.</p><a class="btn btn-pri" href="entrar.html">Área de membros</a></div></aside></div>`;
  }

  function publicacao(id) {
    const p = S.pubs.find(x => String(x.id) === id);
    if (!p) return `<div class="vazio">Esta publicação não existe ou já não está disponível. <a href="#/">Voltar ao início</a></div>`;
    const u = urlSegura(p.imagem_url), l = urlSegura(p.link_url), ax = urlSegura(p.anexo_url);
    document.title = p.titulo + " · NEFE";
    return `<article class="artigo"><a href="#/noticias${p.categoria ? "/" + p.categoria : ""}" class="nota-pe">← Voltar às publicações</a>
      <div style="margin-top:14px"><span class="categoria">${esc(CAT[p.categoria] || "")}</span></div>
      <h1>${esc(p.titulo)}</h1><p class="nota-pe">Publicado a ${esc(fData(p.publicado_em))}</p>
      ${p.resumo ? `<p style="font-size:17px;color:var(--texto2);margin:14px 0 0">${esc(p.resumo)}</p>` : ""}
      ${p.categoria === "evento" && (p.data_evento || p.local) ? `<dl class="ficha-evento">${p.data_evento ? `<dt>Quando</dt><dd>${esc(fEvento(p.data_evento))}</dd>` : ""}${p.local ? `<dt>Onde</dt><dd>${esc(p.local)}</dd>` : ""}</dl>` : ""}
      ${p.categoria === "oportunidade" ? `<dl class="ficha-evento"><dt>Prazo</dt><dd>${esc(prazoTexto(p))}</dd></dl>` : ""}
      ${u ? `<img class="imagem-principal" src="${esc(u)}" alt="">` : ""}
      <div class="corpo-texto" style="margin-top:16px">${paragrafos(p.corpo)}</div>
      ${l || ax ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">${l ? `<a class="btn btn-pri" href="${esc(l)}" target="_blank" rel="noopener">${esc(p.link_texto || "Abrir ligação")}</a>` : ""}${ax ? `<a class="btn" href="${esc(ax)}" target="_blank" rel="noopener">Abrir documento (PDF)</a>` : ""}</div>` : ""}
      <div style="margin-top:28px;padding-top:14px;border-top:1px solid var(--linha);display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="nota-pe">Partilhar esta publicação:</span><button class="btn btn-peq" id="copiar">Copiar ligação</button></div>
    </article>`;
  }

  // ---------------- Navegação ----------------
  function rota() {
    const partes = (location.hash || "#/").replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    const r = partes[0] || "";
    document.title = "NEFE · Núcleo de Estudantes da Faculdade de Economia · UEM";
    $$("#menu a").forEach(a => a.setAttribute("aria-current", a.dataset.r === r || (r === "p" && a.dataset.r === "noticias") ? "page" : "false"));
    const el = $("#conteudo");
    if (!S.pronto) { el.innerHTML = `<div class="carregar">A carregar…</div>`; return; }
    const pag = { "": inicio, noticias: () => noticias(partes[1] || ""), agenda, oportunidades, jornal, sobre, p: () => publicacao(partes[1] || "") }[r];
    el.innerHTML = pag ? pag() : `<div class="vazio">Página não encontrada. <a href="#/">Voltar ao início</a></div>`;
    const b = $("#copiar");
    if (b) b.onclick = async () => { try { await navigator.clipboard.writeText(location.href); NEFE.aviso("Ligação copiada."); } catch (e) { NEFE.aviso("Copie o endereço na barra do navegador."); } };
    window.scrollTo(0, 0);
  }

  function contactoRodape() {
    const e = (S.contactos || {}).email;
    $("#rodape-contacto").innerHTML = e ? `Email: <a href="mailto:${esc(e)}">${esc(e)}</a>` : `<a href="#/sobre">Contactos</a>`;
  }

  window.addEventListener("hashchange", rota);
  NEFE.rodape();
  rota();
  carregar().then(() => { S.pronto = true; contactoRodape(); rota(); });
})();
