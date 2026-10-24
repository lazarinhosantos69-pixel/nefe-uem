# Site do NEFE-UEM

Site oficial do Núcleo de Estudantes da Faculdade de Economia (UEM), com duas partes:

- **Site público** (`index.html`), aberto a todos os estudantes, com início, notícias, agenda, oportunidades, Jornal da Semana e a página «Sobre o NEFE».
- **Área de membros** (`entrar.html` → `membros.html`), só com login. Faz o acompanhamento das actividades segundo o Manual de Procedimentos: fases, passos, prazos, auditoria, publicações do site e administração das contas.

O site fica alojado no **GitHub Pages**, que é gratuito. Os dados, o login e as imagens ficam no **Supabase**, no plano gratuito.

---

## Guia de instalação passo a passo

Tempo estimado: 30 a 40 minutos. Faça os passos pela ordem indicada.

### Antes de começar

- Conta no GitHub (já tem).
- Conta no Supabase: entre em <https://supabase.com> → **Start your project** → **Continue with GitHub**.

### Passo 1 · Criar o projecto no Supabase

1. No painel do Supabase, carregue em **New project**.
2. Preencha:
   - **Name**: `nefe-uem`
   - **Database Password**: gere uma senha forte e **guarde-a** num lugar seguro.
   - **Region**: escolha a mais próxima que estiver disponível.
3. Carregue em **Create new project** e espere 1 a 2 minutos até o projecto ficar pronto.

### Passo 2 · Criar a base de dados

1. No menu da esquerda, abra **SQL Editor** e depois **New query**.
2. Abra o ficheiro `supabase/01-estrutura.sql` com o Bloco de Notas, copie **todo** o conteúdo e cole no editor.
3. Carregue em **Run**. Deve aparecer «Success. No rows returned».
4. Abra uma nova query. Cole o conteúdo de `supabase/02-plano-semestral.sql` e carregue em **Run**. Isto carrega as 23 actividades do Plano do II Semestre e as 4 do I Semestre que não se realizaram.
   - Corra este ficheiro **uma só vez**. Se o correr duas vezes, as actividades ficam duplicadas.

### Passo 3 · Fechar o registo público

Assim, ninguém consegue criar conta sozinho; só a Administração cria contas.

1. Abra **Authentication** → **Sign In / Providers**. Em versões antigas do painel, é **Authentication** → **Providers** → **Email**.
2. **Desligue** a opção **Allow new users to sign up** e guarde.

### Passo 4 · Criar o primeiro administrador (a sua conta)

1. Abra **Authentication** → **Users** → **Add user** → **Create new user**.
2. Escreva o seu email e uma senha, ligue **Auto Confirm User** e carregue em **Create user**.
3. Volte ao **SQL Editor** e abra uma nova query. Cole o conteúdo de `supabase/03-primeiro-administrador.sql`.
4. No texto colado, substitua `O-SEU-EMAIL@exemplo.com` pelo email que usou e `O SEU NOME` pelo seu nome.
5. Carregue em **Run**. No fim deve aparecer uma linha com o seu nome e o cargo `auditor`.
   - Se for o Presidente ou a Vice-Presidente a instalar, troque `'auditor', 'cf'` por `'presidente', 'pres'` ou por `'vice', 'vp'`.

### Passo 5 · Instalar a função de administração

Esta função cria as contas dos membros, repõe senhas e desactiva contas. Corre no servidor do Supabase e guarda a chave secreta longe do navegador.

1. Abra **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Dê à função o nome **exactamente** `admin-utilizadores`.
3. Apague o código de exemplo e cole todo o conteúdo de `supabase/funcoes/admin-utilizadores/index.ts`.
4. Carregue em **Deploy function**.

### Passo 6 · Ligar o site ao Supabase

1. No Supabase, carregue no botão **Connect**, no topo do painel. Em alternativa, abra **Project Settings** → **API Keys** / **Data API**.
2. Copie dois valores:
   - o **Project URL**, que tem o formato `https://xxxxxxxx.supabase.co`;
   - a chave pública: **Publishable key** ou, no separador «Legacy», a **anon public**.
3. Abra o ficheiro `assets/js/config.js` no Bloco de Notas e cole os valores entre aspas:

   ```js
   window.NEFE_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxx.supabase.co",
     SUPABASE_CHAVE_PUBLICA: "a-chave-publica-que-copiou"
   };
   ```

4. Guarde o ficheiro.

> ⚠️ **Nunca** coloque neste ficheiro a chave **secret** / **service_role**. A chave pública pode ser vista por qualquer pessoa sem problema, porque a segurança está nas regras da base de dados.

### Passo 7 · Publicar no GitHub Pages

1. No GitHub, carregue em **New repository**.
   - Nome, por exemplo: `nefe-uem`.
   - Visibilidade **Public**. O GitHub Pages gratuito exige repositório público, e o código não contém segredos.
   - Carregue em **Create repository**.
2. Na página do repositório, carregue em **uploading an existing file**.
3. Abra a pasta do site no seu computador, seleccione **todo o conteúdo dela** (index.html, entrar.html, membros.html, README.md e as pastas assets e supabase) e arraste para a página. Não arraste a pasta em si: o `index.html` tem de ficar na raiz do repositório.
4. Carregue em **Commit changes**.
5. Abra **Settings** → **Pages**:
   - **Source**: **Deploy from a branch**.
   - **Branch**: `main` e pasta `/ (root)`.
   - Carregue em **Save**.
6. Espere 1 a 3 minutos. O site fica em `https://O-SEU-UTILIZADOR.github.io/nefe-uem/`.

### Passo 8 · Indicar o endereço do site ao Supabase

1. No Supabase, abra **Authentication** → **URL Configuration**.
2. Em **Site URL**, cole o endereço do GitHub Pages e guarde.

### Passo 9 · Primeiro uso

1. Abra `https://O-SEU-UTILIZADOR.github.io/nefe-uem/entrar.html` e entre com a conta do passo 4.
2. Em **Administração** → **Configurações**, preencha o texto «Sobre o NEFE», o email, o telefone e as redes sociais.
3. Em **Administração** → **Nova conta**, crie a conta de cada membro.
   - O site gera uma senha temporária. Envie-a à pessoa em privado.
   - No primeiro acesso, a pessoa tem de escolher uma senha nova.
4. O Presidente ou a Vice-Presidente abrem as actividades importadas e atribuem o **departamento responsável**, a **data** e o **orçamento** a cada uma. As actividades sem departamento só são vistas pela Administração, pela Tesouraria e pela Secretaria-Geral.

---

## Quem pode fazer o quê

| Cargo | Vê | Pode fazer |
|---|---|---|
| **Presidente** | Tudo | Aprovar actividades, retomar e reprogramar actividades, aprovar publicações, criar e gerir contas |
| **Vice-Presidente** | Tudo | Decidir no ponto de situação, adiar actividades, mudar o departamento responsável, aprovar publicações, criar e gerir contas |
| **Auditor Interno** | Tudo | Fazer a nota de fiscalização e emitir pareceres, criar e gerir contas. Não altera actividades nem publica, para manter a independência do Conselho Fiscal |
| **Chefe de departamento** | As actividades do seu departamento e aquelas em que o departamento está envolvido | Criar, editar, concluir, adiar e cancelar as actividades do seu departamento; marcar os passos que cabem ao departamento |
| **Membro de departamento** | O mesmo que o seu chefe | Marcar passos e tarefas; escrever notas. Não cria, não conclui e não cancela |
| **Comunicação** (chefe e membros) | Além das actividades, as publicações do site | Preparar publicações (texto, imagem, ligação, PDF) e enviá-las para aprovação |
| **Estudantes (sem login)** | Só o site público | — |

Notas:

- **Tesouraria e Secretaria-Geral** entram em todas as actividades, porque confirmam fundos e abrem os processos (§4.2).
- Os outros departamentos de serviço (UGA, Logística, Comunicação) só vêem uma actividade quando são marcados como «departamentos envolvidos».
- Todas estas regras estão gravadas **na base de dados**. Mesmo que alguém mexa no código da página, o servidor recusa o que o cargo dessa pessoa não permite.

---

## Manutenção

- **Projecto em pausa.** No plano gratuito, o Supabase pausa o projecto depois de **uma semana sem nenhuma actividade**. Com estudantes a visitar o site isso dificilmente acontece. Se acontecer, entre no painel do Supabase e carregue em **Restore project**.
- **Novo semestre.** Vá a **Administração** → **Configurações** → **Semestre actual** e use o formato `I-2027` ou `II-2027`.
- **Cópia de segurança.** No fim de cada mês, em **Actividades**, use **Exportar CSV**.
- **Saída de membros.** Quando alguém sai do NEFE, **desactive** a conta em vez de a apagar. Assim, o histórico continua com o nome da pessoa.
- **Alterar o site.** Edite o ficheiro e, no GitHub, use **Add file** → **Upload files** com o ficheiro novo. A versão antiga é substituída e o site actualiza em 1 a 2 minutos.

## Pré-visualização antes de instalar

Enquanto o `config.js` não estiver preenchido, pode abrir:

- `index.html`, que mostra o site público com conteúdos de exemplo;
- `membros.html?demo=presidente`, que mostra a área de membros com dados de exemplo. No topo há a opção «Ver como», para mudar de cargo.

Nada fica guardado nestes modos de exemplo. Para os abrir no computador, basta dar dois cliques no `index.html`. Na área de membros, acrescente `?demo=presidente` ao endereço, ou use a ligação de pré-visualização que aparece na página «Entrar».

## Resolução de problemas

| Sintoma | Causa provável e solução |
|---|---|
| «O site ainda não está ligado ao Supabase» | O `assets/js/config.js` não foi preenchido ou não foi carregado no GitHub (passo 6). |
| «Email ou senha incorrectos» | Confirme o email. Se a pessoa esqueceu a senha, um administrador usa **Repor senha**. |
| «Esta conta está desactivada ou sem perfil» | A conta existe no Supabase, mas falta o perfil. Crie as contas pelo site (Administração) e não directamente no Supabase. A única excepção é a primeira conta, que é criada com o script 03. |
| Ao criar conta: «A função de administração ainda não foi instalada» | Falta o passo 5, ou o nome da função não é exactamente `admin-utilizadores`. |
| Ao criar conta: «Invalid JWT» ou erro 401 | Em **Edge Functions** → `admin-utilizadores` → **Settings**, desligue **Verify JWT** / **Enforce JWT verification**. A função já verifica sozinha quem é administrador. |
| Ao criar conta: «falta a chave do servidor» | Em **Edge Functions** → **Secrets**, acrescente `SERVICE_ROLE_KEY` com a chave **secret** / **service_role** do projecto. |
| A página pública fica em «A carregar…» | O projecto Supabase está em pausa (veja «Manutenção»). |
| Erro ao correr o SQL | Confirme que copiou o ficheiro todo, do início ao fim. O `01-estrutura.sql` pode correr-se de novo sem perder dados. |

## Estrutura dos ficheiros

```
index.html                 site público
entrar.html                página de login
membros.html               área de membros
assets/css/nefe.css        estilos (cores da UEM, linhas rectas)
assets/js/config.js        ← ligação ao Supabase (preencher)
assets/js/comum.js         funções comuns
assets/js/publico.js       site público
assets/js/membros.js       área de membros
assets/js/demo.js          modo de pré-visualização
assets/vendor/supabase.js  biblioteca oficial do Supabase (v2.117.3)
assets/img/                logótipo, emblema e ícone
supabase/01-estrutura.sql  tabelas, regras de acesso e automatismos
supabase/02-plano-semestral.sql   actividades do Plano (opcional)
supabase/03-primeiro-administrador.sql
supabase/funcoes/admin-utilizadores/index.ts   função de gestão de contas
```
