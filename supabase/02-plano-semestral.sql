-- =====================================================================
-- NEFE-UEM · 02 · Actividades do Plano Semestral
-- Opcional. Carrega as 23 actividades do Plano do II Semestre de 2026 e
-- as 4 do I Semestre que não se realizaram (Manual, §9).
-- Correr UMA vez, depois de 01-estrutura.sql. Os departamentos, datas e
-- orçamentos em falta são completados depois no site.
-- =====================================================================

insert into public.actividades (titulo, tipo, departamento, mes, grupo, tem_receitas, autossustentavel, patrocinavel, objectivo, semestre, estado, motivo, origem_plano, meta) values
('Palestra «Plano A vs Plano B»', 'palestra', null, null, '', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Debate sobre fraude académica', 'palestra', null, null, '', false, false, false, 'O programa consta do panfleto (Manual, §6.1).', 'II-2026', 'activa', null, true, null),
('Palestra sobre excelência académica', 'palestra', null, null, '', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Masterclass (1.ª)', 'palestra', null, null, '', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Masterclass (2.ª)', 'palestra', null, null, '', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Palestra sobre empreendedorismo e financiamento', 'palestra', null, null, 'NEFE Week', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Palestra sobre investimentos no mercado de capitais', 'palestra', null, null, 'NEFE Week', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Mesa redonda', 'palestra', null, null, '', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Workshop de Power BI, VBA, Primavera e MS Project', 'workshop', null, null, '', false, false, false, 'Limite de 31 vagas, com lista de espera; os participantes trazem computador próprio (Manual, §6.2).', 'II-2026', 'activa', null, true, 31),
('Workshop de Excel — módulo II', 'workshop', null, null, '', false, false, false, 'Limite de 31 vagas, com lista de espera (Manual, §6.2).', 'II-2026', 'activa', null, true, 31),
('Olimpíadas', 'concurso', null, null, 'NEFE Week', false, false, true, '', 'II-2026', 'activa', null, true, null),
('Concurso de plano de negócios', 'concurso', null, null, 'NEFE Week', false, false, true, '', 'II-2026', 'activa', null, true, null),
('Apadrinhamento e mentoria', 'programa', null, null, '', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Inglês na Economia', 'programa', null, null, '', true, true, false, 'Curso autossustentável: propinas com recibo e acordo escrito com o formador (Manual, §6.4).', 'II-2026', 'activa', null, true, null),
('Torneio desportivo e feira gastronómica (Setembro)', 'bilheteira', null, 9, '', true, true, false, '', 'II-2026', 'activa', null, true, null),
('Torneio desportivo e feira gastronómica (Outubro)', 'bilheteira', null, 10, '', true, true, false, '', 'II-2026', 'activa', null, true, null),
('Baile da Faculdade de Economia', 'bilheteira', null, null, '', true, true, true, '', 'II-2026', 'activa', null, true, null),
('FACECO Run', 'solidaria', 'incl', null, '', true, false, false, 'Maratona apadrinhada: valor por quilómetro validado (Manual, §6.6).', 'II-2026', 'activa', null, true, null),
('Outubro Rosa', 'solidaria', 'incl', 10, '', false, false, false, 'Rastreio por entidade credenciada, 200 lacinhos cor-de-rosa e sessão de zumba (Manual, §6.6).', 'II-2026', 'activa', null, true, null),
('Natal Solidário', 'solidaria', 'incl', null, '', true, false, false, 'Recolha de doações e entrega a um orfanato (Manual, §6.6).', 'II-2026', 'activa', null, true, null),
('Visitas institucionais por curso', 'visita', null, null, '', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Intercâmbio com outras faculdades e universidades', 'visita', null, null, '', false, false, false, '', 'II-2026', 'activa', null, true, null),
('Camisetes e crachás para os membros (15 + 15)', 'aquisicao', 'pres', null, '', false, false, false, '15 camisetes e 15 crachás, previstos no capítulo «Outros» do Plano.', 'II-2026', 'activa', null, true, null),
('Olimpíadas (I Semestre)', 'concurso', 'acad', 5, '', false, false, false, 'Por curso, em grupos de dois ou três estudantes, com envolvimento dos docentes e entrega de prémios.', 'I-2026', 'nao_realizada', 'Não realizada no I Semestre. Motivo por entregar ao Presidente por escrito (Manual, §9).', false, null),
('Torneio de basquetebol e minifeira', 'bilheteira', 'com', 5, '', true, true, false, 'Equipas masculinas e femininas, minifeira e entrega de prémios. No Plano constava o «Departamento Cultural e Social».', 'I-2026', 'nao_realizada', 'Não realizada no I Semestre. Motivo por entregar ao Presidente por escrito (Manual, §9).', false, null),
('Baile dos caloiros', 'bilheteira', 'com', 6, '', true, true, false, 'Sensibilização para a compra de ingressos; contratação de mesas e cadeiras, alimentos, som e decoração. No Plano constava o «Departamento Cultural e Social».', 'I-2026', 'adiada', 'Adiado no I Semestre. Motivo por entregar ao Presidente por escrito (Manual, §9).', false, null),
('Intercâmbio (I Semestre)', 'visita', 'acad', 6, '', false, false, false, 'Contacto com outras faculdades e universidades.', 'I-2026', 'nao_realizada', 'Não realizada no I Semestre. Motivo por entregar ao Presidente por escrito (Manual, §9).', false, null);
