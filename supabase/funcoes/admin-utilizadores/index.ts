// NEFE-UEM · Função de servidor «admin-utilizadores»
// Cria contas, repõe senhas e activa/desactiva membros.
// Só responde a administradores do site (Presidente, Vice-Presidente, Auditor Interno).
// A chave secreta (service role) só existe aqui, no servidor; nunca vai para o navegador.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CARGOS = ["presidente", "vice", "auditor", "chefe", "membro"];
const DEPTS_CHEFE = ["sg", "tes", "uga", "log", "com", "emp", "acad", "incl"];

function resposta(corpo: unknown, estado = 200) {
  return new Response(JSON.stringify(corpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });
}
const erro = (mensagem: string, estado = 400) => resposta({ erro: mensagem }, estado);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro("Método não permitido.", 405);

  const url = Deno.env.get("SUPABASE_URL");
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!url || !chave) return erro("Função mal configurada: falta a chave do servidor.", 500);
  const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Quem está a pedir?
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return erro("Sessão em falta. Entre novamente.", 401);
  const { data: quem, error: eQuem } = await admin.auth.getUser(token);
  if (eQuem || !quem?.user) return erro("Sessão inválida. Entre novamente.", 401);
  const { data: perfil } = await admin.from("perfis").select("cargo, activo").eq("id", quem.user.id).maybeSingle();
  if (!perfil || !perfil.activo || !["presidente", "vice", "auditor"].includes(perfil.cargo)) {
    return erro("Só a Administração (Presidente, Vice-Presidente e Auditor Interno) pode gerir contas.", 403);
  }

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return erro("Pedido inválido."); }
  const accao = String(corpo.accao || "");

  const registar = (texto: string) =>
    admin.from("historico").insert({ actividade_id: null, titulo: "", texto, tipo: "acesso", por: quem.user.id });

  // 2. Criar conta
  if (accao === "criar") {
    const nome = String(corpo.nome || "").trim();
    const email = String(corpo.email || "").trim().toLowerCase();
    const senha = String(corpo.senha || "");
    const cargo = String(corpo.cargo || "");
    let departamento = corpo.departamento ? String(corpo.departamento) : null;
    if (nome.length < 3) return erro("Indique o nome completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro("Email inválido.");
    if (senha.length < 8) return erro("A senha temporária deve ter pelo menos 8 caracteres.");
    if (!CARGOS.includes(cargo)) return erro("Cargo inválido.");
    if (["chefe", "membro"].includes(cargo)) {
      if (!departamento || !DEPTS_CHEFE.includes(departamento)) return erro("Escolha o departamento.");
    } else {
      departamento = { presidente: "pres", vice: "vp", auditor: "cf" }[cargo] as string;
    }
    const { data: novo, error: eNovo } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { nome },
    });
    if (eNovo || !novo?.user) {
      const m = (eNovo?.message || "").toLowerCase();
      return erro(m.includes("already") ? "Já existe uma conta com este email." : "Não foi possível criar a conta: " + (eNovo?.message || ""));
    }
    const { error: ePerfil } = await admin.from("perfis").insert({
      id: novo.user.id, nome, email, cargo, departamento, activo: true, trocar_senha: true,
    });
    if (ePerfil) {
      await admin.auth.admin.deleteUser(novo.user.id);
      return erro("Não foi possível guardar o perfil: " + ePerfil.message);
    }
    await registar(`criou a conta de ${nome} (${cargo}${["chefe", "membro"].includes(cargo) ? " · " + departamento : ""})`);
    return resposta({ ok: true, id: novo.user.id });
  }

  const id = String(corpo.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return erro("Utilizador inválido.");
  const { data: alvo } = await admin.from("perfis").select("nome, cargo").eq("id", id).maybeSingle();
  if (!alvo) return erro("Utilizador não encontrado.", 404);

  // 3. Repor senha
  if (accao === "senha") {
    const senha = String(corpo.senha || "");
    if (senha.length < 8) return erro("A senha temporária deve ter pelo menos 8 caracteres.");
    const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
    if (error) return erro("Não foi possível repor a senha: " + error.message);
    await admin.from("perfis").update({ trocar_senha: true }).eq("id", id);
    await registar(`repôs a senha de ${alvo.nome}`);
    return resposta({ ok: true });
  }

  // 4. Activar / desactivar
  if (accao === "estado") {
    if (id === quem.user.id) return erro("Não pode desactivar a sua própria conta.");
    const activo = Boolean(corpo.activo);
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : "876000h" });
    if (error) return erro("Não foi possível mudar o estado da conta: " + error.message);
    await admin.from("perfis").update({ activo }).eq("id", id);
    await registar(`${activo ? "reactivou" : "desactivou"} a conta de ${alvo.nome}`);
    return resposta({ ok: true });
  }

  return erro("Acção desconhecida.");
});
