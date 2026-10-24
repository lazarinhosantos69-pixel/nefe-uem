-- =====================================================================
-- NEFE-UEM · 03 · Primeiro administrador
-- 1) No Supabase: Authentication › Users › «Add user» › «Create new user»,
--    com o seu email e uma senha, e a opção «Auto Confirm User» ligada.
-- 2) Troque abaixo O-SEU-EMAIL e O SEU NOME e corra este ficheiro.
--    O cargo pode ser: 'auditor', 'presidente' ou 'vice'.
-- Os restantes membros passam a ser criados dentro do site (Administração).
-- =====================================================================

insert into public.perfis (id, nome, email, cargo, departamento, trocar_senha)
select id, 'Lazarinho Nguenha', email, 'auditor', 'cf', false
from auth.users
where email = 'lazarinho.santos69@gmail.com'
on conflict (id) do update set cargo = excluded.cargo, departamento = excluded.departamento, activo = true;

-- Confirmação: deve aparecer uma linha com o seu nome
select nome, email, cargo, departamento from public.perfis;
