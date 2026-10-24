-- =====================================================================
-- NEFE-UEM · Site e Acompanhamento de Actividades
-- 01 · Estrutura da base de dados, regras de acesso e automatismos
--
-- Como usar: no Supabase, abra «SQL Editor», cole TODO este ficheiro
-- e carregue em «Run». Pode voltar a correr sem perder dados.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

create table if not exists public.departamentos (
  codigo      text primary key,
  nome        text not null,
  nome_curto  text not null,
  descricao   text not null default '',
  servico     boolean not null default false,  -- participa em várias actividades (Tesouraria, SG, UGA, Logística, Comunicação)
  ordem       int not null default 0
);

create table if not exists public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  email         text not null,
  cargo         text not null check (cargo in ('presidente','vice','auditor','chefe','membro')),
  departamento  text references public.departamentos(codigo),
  activo        boolean not null default true,
  trocar_senha  boolean not null default true,
  criado_em     timestamptz not null default now(),
  constraint perfis_dept_obrigatorio check (cargo not in ('chefe','membro') or departamento is not null)
);

create table if not exists public.passos (
  chave     text primary key,
  tipo      text,              -- null = passo geral do ciclo de vida (§4); senão, regra do tipo (§6)
  fase      int,               -- 1..7 nos passos gerais
  ordem     int not null default 0,
  texto     text not null,
  papel     text not null,     -- dep | pres | vp | cf | código de departamento de serviço
  condicao  text,              -- null | estrutural | receitas
  opcional  boolean not null default false
);

create table if not exists public.configuracoes (
  chave  text primary key,
  valor  jsonb not null
);

create table if not exists public.actividades (
  id                        uuid primary key default gen_random_uuid(),
  titulo                    text not null check (length(titulo) between 3 and 160),
  tipo                      text not null default 'palestra',
  departamento              text references public.departamentos(codigo),
  departamentos_envolvidos  text[] not null default '{}',
  data                      date,
  mes                       int check (mes between 1 and 12),
  local                     text not null default '',
  publico_alvo              text not null default '',
  oradores                  text not null default '',
  meta                      int check (meta >= 0),
  orcamento                 numeric(14,2) check (orcamento >= 0),
  despesa                   numeric(14,2) check (despesa >= 0),
  receita_prev              numeric(14,2) check (receita_prev >= 0),
  receita_real              numeric(14,2) check (receita_real >= 0),
  part_real                 int check (part_real >= 0),
  objectivo                 text not null default '',
  grupo                     text not null default '',
  tem_receitas              boolean not null default false,
  autossustentavel          boolean not null default false,
  patrocinavel              boolean not null default false,
  estrutural                boolean not null default false,
  estado                    text not null default 'activa'
                            check (estado in ('activa','concluida','cancelada','adiada','nao_realizada')),
  semestre                  text not null default 'II-2026',
  numero                    int,
  motivo                    text,
  forcada                   jsonb,
  parecer                   jsonb,
  concluida_em              timestamptz,
  origem                    uuid references public.actividades(id) on delete set null,
  reprogramada_para         uuid references public.actividades(id) on delete set null,
  visivel_publico           boolean not null default false,
  resumo_publico            text not null default '',
  origem_plano              boolean not null default false,
  criado_por                uuid references auth.users(id) on delete set null,
  criado_em                 timestamptz not null default now(),
  actualizado_em            timestamptz not null default now()
);
create index if not exists actividades_dept_idx on public.actividades (departamento);

create table if not exists public.checklist (
  actividade_id  uuid not null references public.actividades(id) on delete cascade,
  chave          text not null references public.passos(chave),
  feito          boolean not null default true,
  por            uuid references auth.users(id) on delete set null,
  em             timestamptz not null default now(),
  primary key (actividade_id, chave)
);

create table if not exists public.tarefas (
  id             uuid primary key default gen_random_uuid(),
  actividade_id  uuid not null references public.actividades(id) on delete cascade,
  texto          text not null check (length(texto) between 1 and 300),
  feito          boolean not null default false,
  criado_por     uuid references auth.users(id) on delete set null,
  criado_em      timestamptz not null default now(),
  feito_por      uuid references auth.users(id) on delete set null,
  feito_em       timestamptz
);
create index if not exists tarefas_act_idx on public.tarefas (actividade_id);

create table if not exists public.historico (
  id             bigint generated always as identity primary key,
  actividade_id  uuid references public.actividades(id) on delete set null,
  titulo         text not null default '',
  texto          text not null check (length(texto) between 1 and 2000),
  tipo           text not null default 'acao' check (tipo in ('acao','nota','acesso')),
  por            uuid references auth.users(id) on delete set null,
  em             timestamptz not null default now()
);
create index if not exists historico_act_idx on public.historico (actividade_id, em desc);

create table if not exists public.publicacoes (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null check (length(titulo) between 3 and 180),
  resumo         text not null default '',
  corpo          text not null default '',
  categoria      text not null default 'noticia'
                 check (categoria in ('noticia','evento','oportunidade','jornal','comunicado')),
  imagem_url     text,
  anexo_url      text,
  link_url       text,
  link_texto     text,
  data_evento    timestamptz,
  local          text not null default '',
  prazo          date,
  destaque       boolean not null default false,
  estado         text not null default 'rascunho'
                 check (estado in ('rascunho','submetida','publicada','arquivada')),
  nota_revisao   text,
  autor          uuid references auth.users(id) on delete set null,
  aprovado_por   uuid references auth.users(id) on delete set null,
  publicado_em   timestamptz,
  criado_em      timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);
create index if not exists publicacoes_estado_idx on public.publicacoes (estado, publicado_em desc);

-- ---------------------------------------------------------------------
-- 2. FUNÇÕES DE APOIO (quem é o utilizador, o que pode ver e fazer)
-- ---------------------------------------------------------------------

create or replace function public.hoje() returns date
language sql stable as $$ select (now() at time zone 'Africa/Maputo')::date $$;

create or replace function public.meu_cargo() returns text
language sql stable security definer set search_path = public as $$
  select cargo from perfis where id = auth.uid() and activo
$$;

create or replace function public.meu_dept() returns text
language sql stable security definer set search_path = public as $$
  select departamento from perfis where id = auth.uid() and activo
$$;

create or replace function public.e_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and activo)
$$;

-- Administradores: Presidente, Vice-Presidente e Auditor Interno
create or replace function public.e_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select cargo in ('presidente','vice','auditor') from perfis where id = auth.uid() and activo), false)
$$;

create or replace function public.e_direccao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select cargo in ('presidente','vice') from perfis where id = auth.uid() and activo), false)
$$;

create or replace function public.e_comunicacao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select departamento = 'com' and cargo in ('chefe','membro') from perfis where id = auth.uid() and activo), false)
$$;

-- Tesouraria e Secretaria-Geral entram em todas as actividades (fundos e processo, §4.2)
create or replace function public.normaliza_envolvidos(arr text[], principal text) returns text[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(distinct x order by x), '{}')
  from unnest(coalesce(arr, '{}') || array['tes','sg']) as x
  where x is distinct from principal
    and x in (select codigo from departamentos where codigo not in ('pres','vp','cf'))
$$;

create or replace function public.pode_ver_actividade(p_act uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.e_admin() or exists (
    select 1 from actividades a
    where a.id = p_act
      and (a.departamento = public.meu_dept() or public.meu_dept() = any (a.departamentos_envolvidos))
  )
$$;

-- Um passo é obrigatório para a actividade quando a condição se verifica
-- e o departamento a quem cabe participa nela.
create or replace function public.passo_obrigatorio(a public.actividades, p public.passos) returns boolean
language sql stable as $$
  select p.tipo is null
     and (p.condicao is null
          or (p.condicao = 'estrutural' and a.estrutural)
          or (p.condicao = 'receitas' and a.tem_receitas))
     and (p.papel in ('dep','pres','vp','cf') or p.papel = a.departamento or p.papel = any (a.departamentos_envolvidos))
$$;

create or replace function public.passo_visivel(a public.actividades, p public.passos) returns boolean
language sql stable as $$
  select (p.tipo is null or p.tipo = a.tipo)
     and (p.condicao is null or p.opcional
          or (p.condicao = 'estrutural' and a.estrutural)
          or (p.condicao = 'receitas' and a.tem_receitas))
     and (p.papel in ('dep','pres','vp','cf') or p.papel = a.departamento or p.papel = any (a.departamentos_envolvidos))
$$;

create or replace function public.passos_em_falta(a public.actividades) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from passos p
  where p.tipo is null and p.fase between 1 and 6
    and public.passo_obrigatorio(a, p)
    and not exists (select 1 from checklist c where c.actividade_id = a.id and c.chave = p.chave and c.feito)
$$;

-- Quem pode marcar cada passo (separação de funções, §3.1)
create or replace function public.pode_marcar(p_act uuid, p_chave text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  a actividades; p passos; c text; d text;
begin
  select * into a from actividades where id = p_act;
  if not found or a.estado not in ('activa','concluida') then return false; end if;
  select * into p from passos where chave = p_chave;
  if not found or p_chave = 'f7_par' then return false; end if;   -- o parecer emite-se pelo formulário próprio
  if not public.passo_visivel(a, p) then return false; end if;
  select cargo, departamento into c, d from perfis where id = auth.uid() and activo;
  if c is null then return false; end if;
  if p.papel = 'dep'  then return (c in ('chefe','membro') and d = a.departamento) or c = 'presidente'; end if;
  if p.papel = 'pres' then return c = 'presidente'; end if;
  if p.papel = 'vp'   then return c = 'vice'; end if;
  if p.papel = 'cf'   then return c = 'auditor'; end if;
  return c in ('chefe','membro') and d = p.papel;
end $$;

-- Regra de bloqueio (§4.7): relatório não entregue até 7 dias depois
create or replace function public.dept_bloqueado(p_dept text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from actividades a
    where a.departamento = p_dept
      and a.estado in ('activa','concluida')
      and a.data is not null and a.data + 7 < public.hoje()
      and not exists (select 1 from checklist c where c.actividade_id = a.id and c.chave = 'f6_rel' and c.feito)
  )
$$;

-- Agenda pública: só dados seguros das actividades marcadas como visíveis
create or replace function public.agenda_publica()
returns table (id uuid, titulo text, data date, mes int, local text, resumo text,
               departamento text, estado text, grupo text, semestre text)
language sql stable security definer set search_path = public as $$
  select a.id, a.titulo, a.data, a.mes, a.local, a.resumo_publico, d.nome, a.estado, a.grupo, a.semestre
  from actividades a left join departamentos d on d.codigo = a.departamento
  where a.visivel_publico and a.estado in ('activa','concluida')
  order by a.data nulls last, a.mes nulls last, a.titulo
$$;

-- ---------------------------------------------------------------------
-- 3. AUTOMATISMOS (validação e histórico)
-- ---------------------------------------------------------------------

-- 3.1 Perfis
create or replace function public.trg_perfis_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cargo = 'presidente' then new.departamento := 'pres';
  elsif new.cargo = 'vice' then new.departamento := 'vp';
  elsif new.cargo = 'auditor' then new.departamento := 'cf';
  end if;
  if auth.uid() is null or pg_trigger_depth() > 1 then return new; end if;
  if tg_op = 'INSERT' then
    raise exception 'As contas são criadas pela Administração do site.';
  end if;
  if not public.e_admin() then
    if new.id <> auth.uid() or (to_jsonb(new) - 'trocar_senha') <> (to_jsonb(old) - 'trocar_senha') then
      raise exception 'Sem permissão para alterar este perfil.';
    end if;
  elsif new.id = auth.uid() and (new.activo is distinct from old.activo or new.cargo is distinct from old.cargo) then
    raise exception 'Não pode mudar o seu próprio cargo nem desactivar a sua conta. Peça a outro administrador.';
  end if;
  new.email := old.email;
  return new;
end $$;
drop trigger if exists perfis_guarda on public.perfis;
create trigger perfis_guarda before insert or update on public.perfis
  for each row execute function public.trg_perfis_guarda();

-- 3.2 Actividades: criação
create or replace function public.trg_act_insercao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.departamentos_envolvidos := public.normaliza_envolvidos(new.departamentos_envolvidos, new.departamento);
  if new.data is not null then new.mes := extract(month from new.data)::int; end if;
  if auth.uid() is null then return new; end if;            -- importações feitas no SQL Editor
  new.criado_por := auth.uid();
  new.criado_em := now();
  new.actualizado_em := now();
  new.numero := null; new.parecer := null; new.forcada := null; new.concluida_em := null;
  new.reprogramada_para := null;
  new.semestre := coalesce((select valor #>> '{}' from configuracoes where chave = 'semestre_actual'), new.semestre);
  if new.estado <> 'activa' then
    raise exception 'Uma actividade nova começa sempre activa.';
  end if;
  if new.departamento is not null and public.meu_cargo() <> 'presidente' and public.dept_bloqueado(new.departamento) then
    raise exception 'Departamento bloqueado: há relatório de actividade em atraso (Manual, §4.7). Só o Presidente pode autorizar nova actividade.';
  end if;
  return new;
end $$;
drop trigger if exists act_insercao on public.actividades;
create trigger act_insercao before insert on public.actividades
  for each row execute function public.trg_act_insercao();

-- 3.3 Actividades: alterações (quem pode mudar o quê)
create or replace function public.trg_act_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c text := public.meu_cargo();
  d text := public.meu_dept();
  principal boolean;
  fin text[] := array['despesa','receita_real','part_real','actualizado_em'];
  pub text[] := array['visivel_publico','resumo_publico','actualizado_em'];
  em_falta int;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then
    new.actualizado_em := now();
    return new;
  end if;
  if c is null then raise exception 'Sem permissão.'; end if;
  principal := (c = 'chefe' and d = old.departamento);

  -- campos que nunca se mudam à mão
  new.numero := old.numero; new.criado_por := old.criado_por; new.criado_em := old.criado_em;
  new.semestre := old.semestre; new.origem := old.origem; new.concluida_em := old.concluida_em;

  -- Auditor Interno: só emite o parecer (§3, independência)
  if c = 'auditor' then
    if (to_jsonb(new) - 'parecer' - 'actualizado_em') <> (to_jsonb(old) - 'parecer' - 'actualizado_em') then
      raise exception 'O Auditor Interno não altera actividades; apenas emite o parecer.';
    end if;
    if new.parecer is distinct from old.parecer then
      if old.estado <> 'concluida' then raise exception 'O parecer emite-se depois de a actividade estar concluída.'; end if;
      if old.parecer is not null then raise exception 'Esta actividade já tem parecer emitido.'; end if;
      if coalesce(new.parecer->>'opiniao','') not in ('sem_reservas','com_reservas','desfavoravel') then
        raise exception 'Opinião do parecer inválida.';
      end if;
      new.parecer := new.parecer || jsonb_build_object('por', auth.uid(), 'em', now());
    end if;
    new.actualizado_em := now();
    return new;
  end if;
  if new.parecer is distinct from old.parecer then
    raise exception 'Só o Auditor Interno emite pareceres.';
  end if;

  -- Chefes de outros departamentos: a Tesouraria só regista valores reais
  if c = 'chefe' and not principal then
    if d = 'tes' and (to_jsonb(new) - fin) = (to_jsonb(old) - fin) then
      new.actualizado_em := now();
      return new;
    end if;
    raise exception 'Só o departamento responsável pode alterar esta actividade.';
  end if;
  if c = 'membro' then raise exception 'Só o chefe do departamento pode alterar a actividade.'; end if;

  if new.departamento is distinct from old.departamento and c not in ('presidente','vice') then
    raise exception 'Só o Presidente ou a Vice-Presidente mudam o departamento responsável.';
  end if;

  -- actividades fechadas
  if old.estado in ('cancelada','nao_realizada') and new.estado = old.estado then
    if c = 'presidente' and (to_jsonb(new) - 'reprogramada_para' - 'actualizado_em') = (to_jsonb(old) - 'reprogramada_para' - 'actualizado_em') then
      new.actualizado_em := now(); return new;
    end if;
    raise exception 'Actividade fechada: não se altera.';
  end if;
  if old.estado = 'concluida' and new.estado = 'concluida' then
    if (to_jsonb(new) - fin - pub) <> (to_jsonb(old) - fin - pub) then
      raise exception 'Actividade concluída: só se registam valores reais e a publicação no site.';
    end if;
  end if;

  -- mudanças de situação
  if new.estado is distinct from old.estado then
    if new.estado = 'concluida' then
      if not (principal or c = 'presidente') then raise exception 'Só o departamento responsável ou o Presidente concluem a actividade.'; end if;
      if old.estado <> 'activa' then raise exception 'Só se conclui uma actividade activa.'; end if;
      em_falta := public.passos_em_falta(new);
      if em_falta > 0 then
        if new.forcada is null or length(trim(coalesce(new.forcada->>'motivo',''))) < 5 then
          raise exception 'Faltam % passo(s) obrigatório(s). Para concluir assim, escreva a justificação.', em_falta;
        end if;
        new.forcada := jsonb_build_object('motivo', trim(new.forcada->>'motivo'), 'pendentes', em_falta, 'por', auth.uid(), 'em', now());
      else
        new.forcada := null;
      end if;
      new.concluida_em := now();
    elsif new.estado = 'cancelada' then
      if not (principal or c = 'presidente') then raise exception 'Só o departamento responsável ou o Presidente cancelam a actividade.'; end if;
      if old.estado not in ('activa','adiada') then raise exception 'Esta actividade não pode ser cancelada.'; end if;
      if length(trim(coalesce(new.motivo,''))) < 3 then raise exception 'Indique o motivo do cancelamento.'; end if;
    elsif new.estado = 'adiada' then
      if not (principal or c in ('presidente','vice')) then raise exception 'Sem permissão para adiar.'; end if;
      if old.estado <> 'activa' then raise exception 'Só se adia uma actividade activa.'; end if;
      if length(trim(coalesce(new.motivo,''))) < 3 then raise exception 'Indique o motivo do adiamento.'; end if;
    elsif new.estado = 'activa' then
      if c <> 'presidente' then raise exception 'Só o Presidente retoma actividades adiadas ou canceladas.'; end if;
      if old.estado not in ('adiada','cancelada') then raise exception 'Mudança de situação inválida.'; end if;
    else
      raise exception 'Mudança de situação inválida.';
    end if;
  end if;

  new.departamentos_envolvidos := public.normaliza_envolvidos(new.departamentos_envolvidos, new.departamento);
  if new.data is not null then new.mes := extract(month from new.data)::int; end if;
  new.actualizado_em := now();
  return new;
end $$;
drop trigger if exists act_guarda on public.actividades;
create trigger act_guarda before update on public.actividades
  for each row execute function public.trg_act_guarda();

-- 3.4 Actividades: histórico automático
create or replace function public.trg_act_historico() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ignora text[] := array['actualizado_em','numero','concluida_em','forcada','motivo','estado','parecer',
                         'departamento','despesa','receita_real','part_real','reprogramada_para',
                         'visivel_publico','resumo_publico','origem_plano','departamentos_envolvidos'];
  t text;
begin
  if tg_op = 'INSERT' then
    insert into historico (actividade_id, titulo, texto, por)
    values (new.id, new.titulo,
            case when new.origem is not null then 'criou a actividade por reprogramação' else 'registou a actividade' end,
            auth.uid());
    return null;
  end if;
  if pg_trigger_depth() > 1 then return null; end if;

  if new.estado is distinct from old.estado then
    t := case new.estado
           when 'concluida' then case when new.forcada is not null
                                      then 'concluiu com ' || (new.forcada->>'pendentes') || ' passo(s) em falta: ' || (new.forcada->>'motivo')
                                      else 'concluiu a actividade' end
           when 'cancelada' then 'cancelou a actividade: ' || coalesce(new.motivo,'')
           when 'adiada'    then 'adiou a actividade: ' || coalesce(new.motivo,'')
           when 'activa'    then 'retomou a actividade'
           else 'mudou a situação' end;
    insert into historico (actividade_id, titulo, texto, por) values (new.id, new.titulo, t, auth.uid());
  end if;
  if new.parecer is not null and old.parecer is null then
    insert into historico (actividade_id, titulo, texto, por)
    values (new.id, new.titulo, 'emitiu parecer «' ||
            case new.parecer->>'opiniao' when 'sem_reservas' then 'sem reservas'
                                          when 'com_reservas' then 'com reservas' else 'desfavorável' end || '»', auth.uid());
    insert into checklist (actividade_id, chave, feito, por) values (new.id, 'f7_par', true, auth.uid())
    on conflict (actividade_id, chave) do update set feito = true, por = excluded.por, em = now();
  end if;
  if new.departamento is distinct from old.departamento then
    insert into historico (actividade_id, titulo, texto, por)
    values (new.id, new.titulo, 'atribuiu a actividade a ' ||
            coalesce((select nome from departamentos where codigo = new.departamento), 'nenhum departamento'), auth.uid());
  end if;
  if (new.despesa, new.receita_real, new.part_real) is distinct from (old.despesa, old.receita_real, old.part_real) then
    insert into historico (actividade_id, titulo, texto, por) values (new.id, new.titulo, 'registou valores reais (despesa, receita, participantes)', auth.uid());
  end if;
  if new.reprogramada_para is distinct from old.reprogramada_para and new.reprogramada_para is not null then
    insert into historico (actividade_id, titulo, texto, por) values (new.id, new.titulo, 'reprogramou a actividade no semestre actual', auth.uid());
  end if;
  if new.visivel_publico is distinct from old.visivel_publico then
    insert into historico (actividade_id, titulo, texto, por)
    values (new.id, new.titulo, case when new.visivel_publico then 'mostrou a actividade na agenda pública' else 'retirou a actividade da agenda pública' end, auth.uid());
  end if;
  if (to_jsonb(new) - ignora) <> (to_jsonb(old) - ignora) or new.departamentos_envolvidos is distinct from old.departamentos_envolvidos then
    insert into historico (actividade_id, titulo, texto, por) values (new.id, new.titulo, 'editou os dados da actividade', auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists act_historico on public.actividades;
create trigger act_historico after insert or update on public.actividades
  for each row execute function public.trg_act_historico();

-- Eliminação de uma actividade fica registada no histórico geral
create or replace function public.trg_act_eliminacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into historico (actividade_id, titulo, texto, por)
  values (null, old.titulo, 'eliminou o registo da actividade «' || old.titulo || '»', auth.uid());
  return old;
end $$;
drop trigger if exists act_eliminacao on public.actividades;
create trigger act_eliminacao before delete on public.actividades
  for each row execute function public.trg_act_eliminacao();

-- 3.5 Passos (checklist)
create or replace function public.trg_chk_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 then
    if not public.pode_marcar(new.actividade_id, new.chave) then
      raise exception 'Este passo não cabe ao seu cargo, ou a actividade está fechada.';
    end if;
  end if;
  if auth.uid() is null then return new; end if;
  new.por := auth.uid();
  new.em := now();
  return new;
end $$;
drop trigger if exists chk_guarda on public.checklist;
create trigger chk_guarda before insert or update on public.checklist
  for each row execute function public.trg_chk_guarda();

create or replace function public.trg_chk_depois() returns trigger
language plpgsql security definer set search_path = public as $$
declare txt text;
begin
  if tg_op = 'UPDATE' and new.feito = old.feito then return null; end if;
  -- número sequencial do processo (§4.2) quando a Secretaria-Geral abre o processo
  if new.chave = 'f2_proc' and new.feito then
    perform pg_advisory_xact_lock(424242);
    update actividades set numero = (select coalesce(max(numero), 0) + 1 from actividades)
    where id = new.actividade_id and numero is null;
  end if;
  if new.chave = 'f7_par' then return null; end if;
  select texto into txt from passos where chave = new.chave;
  insert into historico (actividade_id, titulo, texto, por)
  values (new.actividade_id, (select titulo from actividades where id = new.actividade_id),
          case when new.feito then 'confirmou: ' else 'desmarcou: ' end || txt, auth.uid());
  return null;
end $$;
drop trigger if exists chk_depois on public.checklist;
create trigger chk_depois after insert or update on public.checklist
  for each row execute function public.trg_chk_depois();

-- 3.6 Tarefas do departamento
create or replace function public.pode_gerir_tarefas(p_act uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from actividades a join perfis p on p.id = auth.uid() and p.activo
    where a.id = p_act and a.estado in ('activa','concluida')
      and ((p.cargo in ('chefe','membro') and p.departamento = a.departamento) or p.cargo = 'presidente')
  )
$$;

create or replace function public.trg_tarefa_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- operações do sistema (ex.: apagar utilizador)
  if tg_op = 'INSERT' then
    new.criado_por := auth.uid(); new.criado_em := now(); new.feito := false; new.feito_por := null; new.feito_em := null;
  else
    new.texto := old.texto; new.criado_por := old.criado_por; new.criado_em := old.criado_em; new.actividade_id := old.actividade_id;
    if new.feito is distinct from old.feito then
      new.feito_por := case when new.feito then auth.uid() else null end;
      new.feito_em := case when new.feito then now() else null end;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tarefa_guarda on public.tarefas;
create trigger tarefa_guarda before insert or update on public.tarefas
  for each row execute function public.trg_tarefa_guarda();

create or replace function public.trg_tarefa_historico() returns trigger
language plpgsql security definer set search_path = public as $$
declare a_id uuid; t text;
begin
  if tg_op = 'INSERT' then a_id := new.actividade_id; t := 'acrescentou a tarefa «' || new.texto || '»';
  elsif tg_op = 'UPDATE' then
    if new.feito = old.feito then return null; end if;
    a_id := new.actividade_id; t := case when new.feito then 'concluiu a tarefa «' else 'reabriu a tarefa «' end || new.texto || '»';
  else
    a_id := old.actividade_id; t := 'removeu a tarefa «' || old.texto || '»';
    if not exists (select 1 from actividades where id = a_id) then return null; end if;  -- actividade eliminada
  end if;
  insert into historico (actividade_id, titulo, texto, por)
  values (a_id, coalesce((select titulo from actividades where id = a_id), ''), t, auth.uid());
  return null;
end $$;
drop trigger if exists tarefa_historico on public.tarefas;
create trigger tarefa_historico after insert or update or delete on public.tarefas
  for each row execute function public.trg_tarefa_historico();

-- 3.7 Histórico: as notas ficam sempre com o nome de quem escreve
create or replace function public.trg_hist_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 then
    new.tipo := 'nota';
    new.por := auth.uid();
    new.em := now();
    new.titulo := coalesce((select titulo from actividades where id = new.actividade_id), '');
  end if;
  return new;
end $$;
drop trigger if exists hist_guarda on public.historico;
create trigger hist_guarda before insert on public.historico
  for each row execute function public.trg_hist_guarda();

-- 3.8 Publicações: aprovação antes de sair no site (§6.8)
create or replace function public.trg_pub_guarda() returns trigger
language plpgsql security definer set search_path = public as $$
declare exige boolean;
begin
  if tg_op = 'INSERT' then
    new.criado_em := now();
    if auth.uid() is not null then new.autor := auth.uid(); new.aprovado_por := null; new.publicado_em := null; end if;
  elsif auth.uid() is not null then
    new.autor := old.autor; new.criado_em := old.criado_em;
    if new.estado <> 'publicada' then new.aprovado_por := old.aprovado_por; end if;
  end if;
  exige := coalesce((select (valor #>> '{}')::boolean from configuracoes where chave = 'publicacoes_exigem_aprovacao'), true);
  if auth.uid() is not null and tg_op = 'UPDATE' and old.estado = 'publicada' and new.estado = 'publicada'
     and exige and not public.e_direccao()
     and (to_jsonb(new) - 'actualizado_em' - 'destaque') <> (to_jsonb(old) - 'actualizado_em' - 'destaque') then
    raise exception 'Uma publicação já publicada só é alterada com nova aprovação: envie as alterações para aprovação.';
  end if;
  if auth.uid() is not null and new.estado = 'publicada' and (tg_op = 'INSERT' or old.estado <> 'publicada') then
    if exige and not public.e_direccao() then
      raise exception 'Esta publicação precisa de aprovação do Presidente ou da Vice-Presidente antes de sair no site.';
    end if;
    new.aprovado_por := auth.uid();
    new.publicado_em := now();
    new.nota_revisao := null;
  end if;
  new.actualizado_em := now();
  return new;
end $$;
drop trigger if exists pub_guarda on public.publicacoes;
create trigger pub_guarda before insert or update on public.publicacoes
  for each row execute function public.trg_pub_guarda();

-- ---------------------------------------------------------------------
-- 4. REGRAS DE ACESSO (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.departamentos enable row level security;
alter table public.perfis        enable row level security;
alter table public.passos        enable row level security;
alter table public.configuracoes enable row level security;
alter table public.actividades   enable row level security;
alter table public.checklist     enable row level security;
alter table public.tarefas       enable row level security;
alter table public.historico     enable row level security;
alter table public.publicacoes   enable row level security;

-- Departamentos e configurações: leitura pública (página «Sobre»), escrita pelos administradores
drop policy if exists dep_ler on public.departamentos;
create policy dep_ler on public.departamentos for select using (true);
drop policy if exists dep_escrever on public.departamentos;
create policy dep_escrever on public.departamentos for update to authenticated using (public.e_admin()) with check (public.e_admin());

drop policy if exists cfg_ler on public.configuracoes;
create policy cfg_ler on public.configuracoes for select using (true);
drop policy if exists cfg_inserir on public.configuracoes;
create policy cfg_inserir on public.configuracoes for insert to authenticated with check (public.e_admin());
drop policy if exists cfg_alterar on public.configuracoes;
create policy cfg_alterar on public.configuracoes for update to authenticated using (public.e_admin()) with check (public.e_admin());

-- Perfis: membros vêem-se uns aos outros; só administradores alteram (a criação é feita pela função de servidor)
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated using (public.e_membro() or id = auth.uid());
drop policy if exists perfis_alterar on public.perfis;
create policy perfis_alterar on public.perfis for update to authenticated
  using (public.e_admin() or id = auth.uid()) with check (public.e_admin() or id = auth.uid());

drop policy if exists passos_ler on public.passos;
create policy passos_ler on public.passos for select to authenticated using (public.e_membro());

-- Actividades: cada departamento vê as suas e as que partilha; Presidente, Vice e Auditor vêem todas
drop policy if exists act_ler on public.actividades;
create policy act_ler on public.actividades for select to authenticated
  using (public.e_admin() or departamento = public.meu_dept() or public.meu_dept() = any (departamentos_envolvidos));
drop policy if exists act_criar on public.actividades;
create policy act_criar on public.actividades for insert to authenticated
  with check ((public.meu_cargo() = 'chefe' and departamento = public.meu_dept()) or public.e_direccao());
drop policy if exists act_alterar on public.actividades;
create policy act_alterar on public.actividades for update to authenticated
  using ((public.e_admin() or departamento = public.meu_dept() or public.meu_dept() = any (departamentos_envolvidos))
         and public.meu_cargo() in ('presidente','vice','auditor','chefe'))
  with check (true);
drop policy if exists act_apagar on public.actividades;
create policy act_apagar on public.actividades for delete to authenticated using (public.meu_cargo() = 'presidente');

drop policy if exists chk_ler on public.checklist;
create policy chk_ler on public.checklist for select to authenticated using (public.pode_ver_actividade(actividade_id));
drop policy if exists chk_criar on public.checklist;
create policy chk_criar on public.checklist for insert to authenticated with check (public.pode_marcar(actividade_id, chave));
drop policy if exists chk_alterar on public.checklist;
create policy chk_alterar on public.checklist for update to authenticated
  using (public.pode_marcar(actividade_id, chave)) with check (public.pode_marcar(actividade_id, chave));

drop policy if exists tar_ler on public.tarefas;
create policy tar_ler on public.tarefas for select to authenticated using (public.pode_ver_actividade(actividade_id));
drop policy if exists tar_criar on public.tarefas;
create policy tar_criar on public.tarefas for insert to authenticated with check (public.pode_gerir_tarefas(actividade_id));
drop policy if exists tar_alterar on public.tarefas;
create policy tar_alterar on public.tarefas for update to authenticated
  using (public.pode_gerir_tarefas(actividade_id)) with check (public.pode_gerir_tarefas(actividade_id));
drop policy if exists tar_apagar on public.tarefas;
create policy tar_apagar on public.tarefas for delete to authenticated using (public.pode_gerir_tarefas(actividade_id));

-- Histórico: só se acrescentam notas; nunca se altera nem apaga
drop policy if exists hist_ler on public.historico;
create policy hist_ler on public.historico for select to authenticated
  using (public.e_admin() or (actividade_id is not null and public.pode_ver_actividade(actividade_id)));
drop policy if exists hist_nota on public.historico;
create policy hist_nota on public.historico for insert to authenticated
  with check (actividade_id is not null and public.pode_ver_actividade(actividade_id));

-- Publicações: o público vê as publicadas; Comunicação e Direcção gerem
drop policy if exists pub_ler_publico on public.publicacoes;
create policy pub_ler_publico on public.publicacoes for select using (estado = 'publicada');
drop policy if exists pub_ler_equipa on public.publicacoes;
create policy pub_ler_equipa on public.publicacoes for select to authenticated using (public.e_comunicacao() or public.e_direccao());
drop policy if exists pub_criar on public.publicacoes;
create policy pub_criar on public.publicacoes for insert to authenticated with check (public.e_comunicacao() or public.e_direccao());
drop policy if exists pub_alterar on public.publicacoes;
create policy pub_alterar on public.publicacoes for update to authenticated
  using (public.e_comunicacao() or public.e_direccao()) with check (public.e_comunicacao() or public.e_direccao());
drop policy if exists pub_apagar on public.publicacoes;
create policy pub_apagar on public.publicacoes for delete to authenticated
  using (public.e_direccao() or (public.e_comunicacao() and estado <> 'publicada'));

-- Imagens e anexos das publicações (armazenamento)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_ler on storage.objects;
create policy media_ler on storage.objects for select using (bucket_id = 'media');
drop policy if exists media_enviar on storage.objects;
create policy media_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (public.e_comunicacao() or public.e_direccao()));
drop policy if exists media_apagar on storage.objects;
create policy media_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (public.e_comunicacao() or public.e_direccao()));

-- O público só pode chamar a agenda pública
revoke execute on function public.agenda_publica() from public;
grant execute on function public.agenda_publica() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. DADOS DE REFERÊNCIA
-- ---------------------------------------------------------------------

insert into public.departamentos (codigo, nome, nome_curto, descricao, servico, ordem) values
 ('pres','Presidência','Presidência','Aprova previamente as actividades, a correspondência, os contratos e as despesas, e representa o Núcleo.',false,1),
 ('vp','Vice-Presidência','Vice-Presidência','Coordena os departamentos, controla os prazos e consolida os relatórios de execução.',false,2),
 ('sg','Secretaria-Geral','Secretaria-Geral','Redige convites, ofícios e comunicados, abre e arquiva os processos das actividades e lavra as actas.',true,3),
 ('tes','Tesouraria','Tesouraria','Confirma a disponibilidade de fundos, regista receitas e despesas, guarda os comprovativos e mantém a reserva.',true,4),
 ('uga','Unidade de Gestão e Aquisição','UGA','Pede cotações, contrata fornecedores, emite requisições e mantém o inventário.',true,5),
 ('log','Departamento de Logística','Logística','Prepara os espaços, gere os materiais e monta e desmonta os eventos.',true,6),
 ('com','Departamento da Comunicação, Desporto, Cultura e Imagem','Comunicação','Divulgação, imagem e registo fotográfico do Núcleo; actividades desportivas e culturais.',true,7),
 ('emp','Departamento de Empreendedorismo e Carreira','Empreendedorismo','Empreendedorismo, preparação para a carreira e ligação ao mercado de trabalho.',false,8),
 ('acad','Departamento Académico e Científico','Académico','Actividades académicas e científicas: palestras, olimpíadas e intercâmbios.',false,9),
 ('incl','Departamento da Inclusão e Bem-Estar Estudantil','Inclusão e Bem-Estar','Acções solidárias e de saúde, como a FACECO Run, o Outubro Rosa e o Natal Solidário.',false,10),
 ('cf','Conselho Fiscal','Conselho Fiscal','Gabinete de Auditoria Interna: fiscaliza o orçamento e os eventos e emite parecer sobre cada actividade.',false,11)
on conflict (codigo) do nothing;

insert into public.configuracoes (chave, valor) values
 ('semestre_actual', '"II-2026"'),
 ('publicacoes_exigem_aprovacao', 'true'),
 ('contactos', '{"email":"","telefone":"","morada":"Faculdade de Economia, Universidade Eduardo Mondlane, Maputo","facebook":"","instagram":""}'),
 ('sobre', '"O Núcleo de Estudantes da Faculdade de Economia (NEFE) representa os estudantes da Faculdade de Economia da Universidade Eduardo Mondlane e organiza actividades académicas, profissionais, culturais, desportivas e solidárias ao longo do ano."')
on conflict (chave) do nothing;

insert into public.passos (chave, tipo, fase, ordem, texto, papel, condicao, opcional) values
 ('f1_prop', null, 1, 1, 'Proposta escrita apresentada (objectivo, público-alvo, data, local, oradores, meta)', 'dep', null, false),
 ('f1_orc',  null, 1, 2, 'Orçamento em meticais elaborado com a Tesouraria, com as fontes de receita', 'dep', null, false),
 ('f2_fundos', null, 2, 1, 'Disponibilidade de fundos e reserva de 10% confirmadas', 'tes', null, false),
 ('f2_aprov',  null, 2, 2, 'Actividade e orçamento aprovados pelo Presidente', 'pres', null, false),
 ('f2_cd',     null, 2, 3, 'Despesa estrutural aprovada pelo Conselho de Direcção e registada em acta', 'pres', 'estrutural', false),
 ('f2_proc',   null, 2, 4, 'Processo aberto com número sequencial e capa', 'sg', null, false),
 ('f3_conv', null, 3, 1, 'Convites, ofícios e pedidos de patrocínio assinados e arquivados com registo de saída', 'sg', null, false),
 ('f3_cot',  null, 3, 2, 'Cotações comparadas (três acima do limite) e fornecedor escolhido', 'uga', null, false),
 ('f3_pag',  null, 3, 3, 'Requisição emitida e pagamento com duas assinaturas, contra factura em nome do Núcleo', 'tes', null, false),
 ('f3_div',  null, 3, 4, 'Material de divulgação produzido e arte final aprovada pelo Presidente', 'com', null, false),
 ('f4_ps',  null, 4, 1, 'Ponto de situação entregue (bens disponíveis, pendências, riscos)', 'uga', null, false),
 ('f4_dec', null, 4, 2, 'Decisão da Vice-Presidente: avança, é ajustada ou é adiada', 'vp', null, false),
 ('f5_esp',  null, 5, 1, 'Espaço montado e materiais entregues contra assinatura', 'log', null, false),
 ('f5_pres', null, 5, 2, 'Presenças registadas', 'dep', null, false),
 ('f5_rec',  null, 5, 3, 'Receitas e consumo de bens registados', 'tes', 'receitas', false),
 ('f5_foto', null, 5, 4, 'Registo fotográfico feito', 'com', null, false),
 ('f5_fisc', null, 5, 5, 'Nota de fiscalização no local', 'cf', 'receitas', true),
 ('f6_mat', null, 6, 1, 'Materiais devolvidos, estado verificado e inventário actualizado', 'log', null, false),
 ('f6_dep', null, 6, 2, 'Receitas depositadas até 48 horas e caixa conferida a duas pessoas', 'tes', 'receitas', false),
 ('f6_rel', null, 6, 3, 'Relatório da actividade e prestação de contas entregues', 'dep', null, false),
 ('f6_arq', null, 6, 4, 'Processo completo arquivado', 'sg', null, false),
 ('f7_par', null, 7, 1, 'Parecer escrito do Conselho Fiscal emitido', 'cf', null, false),
 ('palestra_1','palestra',null,1,'Convite escrito ao orador até 21 dias antes e confirmação escrita','dep',null,false),
 ('palestra_2','palestra',null,2,'Panfletos com o programa aprovados até 10 dias antes','dep',null,false),
 ('palestra_3','palestra',null,3,'Lista de presenças (nome, curso, contacto) aberta e fechada à hora marcada','dep',null,false),
 ('palestra_4','palestra',null,4,'Certificado de mérito numerado ao orador, registado no livro de certificados','dep',null,false),
 ('palestra_5','palestra',null,5,'Água e lanche calculados pelos inscritos + 10%; sobras inventariadas','dep',null,false),
 ('workshop_1','workshop',null,1,'Inscrições prévias com limite de 31 vagas e lista de espera','dep',null,false),
 ('workshop_2','workshop',null,2,'Aviso de computador próprio com o programa; sala com tomadas confirmada','dep',null,false),
 ('workshop_3','workshop',null,3,'Acordo escrito com o formador (conteúdo, horas, honorários ou voluntário)','dep',null,false),
 ('workshop_4','workshop',null,4,'Presença à entrada e à saída; certificado só com 80% da carga horária','dep',null,false),
 ('workshop_5','workshop',null,5,'Certificados numerados; cartolinas e impressões não usadas devolvidas à UGA','dep',null,false),
 ('concurso_1','concurso',null,1,'Regulamento aprovado no Conselho de Direcção até 30 dias antes','dep',null,false),
 ('concurso_2','concurso',null,2,'Júri com pelo menos 3 membros e declarações de ausência de conflito de interesses','dep',null,false),
 ('concurso_3','concurso',null,3,'Provas guardadas em sigilo até à aplicação','dep',null,false),
 ('concurso_4','concurso',null,4,'Grelhas individuais assinadas e acta de classificação assinada pelo júri','dep',null,false),
 ('concurso_5','concurso',null,5,'Prémios entregues contra assinatura; prémios doados registados como receita em bens','dep',null,false),
 ('concurso_6','concurso',null,6,'Encaminhamentos para incubação formalizados por carta','dep',null,false),
 ('programa_1','programa',null,1,'Fichas de inscrição de mentores, padrinhos e mentorandos; emparelhamento aprovado','dep',null,false),
 ('programa_2','programa',null,2,'Mapa mensal das sessões assinado pelos participantes','dep',null,false),
 ('programa_3','programa',null,3,'Curso autossustentável: tabela de propinas, recibo por pagamento e acordo com o formador','dep',null,false),
 ('programa_4','programa',null,4,'Despesas com chamadas justificadas por mapa de contactos','dep',null,false),
 ('programa_5','programa',null,5,'Relatório de fim de semestre com assiduidade e resultados','dep',null,false),
 ('bilheteira_1','bilheteira',null,1,'Orçamento com ponto de equilíbrio (bilhetes e bancas mínimos)','dep',null,false),
 ('bilheteira_2','bilheteira',null,2,'Bilhetes com numeração prévia entregues aos vendedores contra assinatura','dep',null,false),
 ('bilheteira_3','bilheteira',null,3,'Bancas: inscrição escrita, taxa com recibo e compromisso de higiene e segurança','dep',null,false),
 ('bilheteira_4','bilheteira',null,4,'Regulamento do torneio divulgado antes do início','dep',null,false),
 ('bilheteira_5','bilheteira',null,5,'Baile: contratos escritos com local, som e alimentação; entrada por bilhete','dep',null,false),
 ('bilheteira_6','bilheteira',null,6,'Caixa contada a duas pessoas, depósito em 48 horas e relatório com resultado líquido','dep',null,false),
 ('solidaria_1','solidaria',null,1,'Fichas de compromisso dos padrinhos ou registo de cada doação (doador, bem, quantidade, valor)','dep',null,false),
 ('solidaria_2','solidaria',null,2,'Quilómetros validados por fiscal de percurso ou aplicação, com assinatura','dep',null,false),
 ('solidaria_3','solidaria',null,3,'Rastreio apenas por entidade credenciada, sem guardar resultados','dep',null,false),
 ('solidaria_4','solidaria',null,4,'Lacinhos e bens controlados (adquiridos, distribuídos, sobras)','dep',null,false),
 ('solidaria_5','solidaria',null,5,'Entrega ao beneficiário com declaração ou guia assinada e fotografias','dep',null,false),
 ('solidaria_6','solidaria',null,6,'Total angariado divulgado publicamente','dep',null,false),
 ('visita_1','visita',null,1,'Ofício à entidade anfitriã até 21 dias antes e confirmação escrita','dep',null,false),
 ('visita_2','visita',null,2,'Lista nominal por curso e termos de responsabilidade assinados','dep',null,false),
 ('visita_3','visita',null,3,'Transporte com três cotações e contrato (horário, percurso, valor)','dep',null,false),
 ('visita_4','visita',null,4,'Embarque controlado na ida e no regresso','dep',null,false),
 ('visita_5','visita',null,5,'Relatório com aprendizagens e contactos estabelecidos','dep',null,false),
 ('comunicacao_1','comunicacao',null,1,'Conteúdos aprovados antes da publicação','dep',null,false),
 ('comunicacao_2','comunicacao',null,2,'Questionários anónimos ou com consentimento; dados nunca divulgados individualmente','dep',null,false),
 ('comunicacao_3','comunicacao',null,3,'Resultados apresentados ao Conselho de Direcção','dep',null,false),
 ('aquisicao_1','aquisicao',null,1,'Lista nominal dos membros abrangidos aprovada pelo Presidente','dep',null,false),
 ('aquisicao_2','aquisicao',null,2,'Cotações pedidas e requisição emitida pela UGA','dep',null,false),
 ('aquisicao_3','aquisicao',null,3,'Entrega a cada membro contra assinatura; crachás devolvidos no fim do mandato','dep',null,false)
on conflict (chave) do update set texto = excluded.texto, papel = excluded.papel, condicao = excluded.condicao,
  opcional = excluded.opcional, fase = excluded.fase, ordem = excluded.ordem, tipo = excluded.tipo;
