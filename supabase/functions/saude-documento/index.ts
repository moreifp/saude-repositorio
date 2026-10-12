// saude-documento — Saúde Repositório (dentro do projeto gerenciador-casa).
//
// Ações (POST JSON, com o JWT do dono no Authorization):
//   { action: "ler",   id }   → lê a foto/PDF com o Claude e preenche o documento
//   { action: "drive", id }   → manda o original para o Google Drive e limpa a caixa de entrada
//   { action: "pendentes" }   → reenvia ao Drive o que ficou para trás
//
// Arquivos: bucket privado `saude-inbox/<user>/<id>.<ext>` (original) e
// `saude-inbox/<user>/<id>-ler.jpg` (versão para leitura, só de fotos).
// Drive: "Saúde Repositório/<Receitas|Pedidos|Exames>/AAAA-MM-DD Tipo Nome id8.ext".

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODELO = Deno.env.get("SAUDE_MODELO") || "claude-sonnet-5-5";
const DONO = (Deno.env.get("SAUDE_DONO_EMAIL") ?? "fausto.moreira@gmail.com").trim().toLowerCase();
const DRIVE_CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") ?? "";
const DRIVE_CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") ?? "";
const DRIVE_REFRESH_TOKEN = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN") ?? "";
const INBOX = "saude-inbox";
const PASTA_RAIZ = "Saúde Repositório";
const SUBPASTA: Record<string, string> = { receita: "Receitas", pedido: "Pedidos de exame", exame: "Exames" };
const TIPO_NOME: Record<string, string> = { receita: "Receita", pedido: "Pedido", exame: "Exame" };
const FOLDER_MIME = "application/vnd.google-apps.folder";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------
// Leitura com o Claude

const INSTRUCAO = `Você lê documentos médicos brasileiros (foto ou PDF) do próprio paciente, para o arquivo pessoal de saúde dele.
Responda SOMENTE com um objeto JSON, sem texto antes ou depois, neste formato:
{"categoria":"receita"|"pedido"|"exame","medico":"","crm":"","data":"AAAA-MM-DD","remedios":[{"nome":"","dose":"","horario":""}],"pedidos":[""],"exame":{"nome":"","local":"","tipo":"lab"|"img"}}
Regras:
- categoria: "receita" = receita ou prescrição de remédios; "pedido" = pedido ou solicitação de exames; "exame" = resultado de exame, laudo de imagem ou documento de hospital.
- medico: nome do médico como está escrito, com "Dr." ou "Dra." se houver.
- crm: número do CRM com a UF, no formato "SP 123456".
- data: data de emissão (para resultado de exame, a data da coleta ou do laudo), formato AAAA-MM-DD.
- remedios: só para receita. nome do remédio com a concentração (ex.: "Dipirona 1 g"); dose = quantidade por vez (ex.: "1 comprimido"); horario = posologia curta (ex.: "12 em 12 h", "Antes de dormir", "Se tiver dor").
- pedidos: nomes curtos dos exames pedidos.
- exame: só para resultado. nome curto do exame; local = laboratório, clínica ou hospital; tipo "img" para raio-X, ultrassom, tomografia, ressonância, ecocardiograma, endoscopia e similares, senão "lab".
- Deixe "" ou [] o que não conseguir ler com segurança. Não invente nada.`;

type Lido = {
  categoria?: string; medico?: string; crm?: string; data?: string;
  remedios?: Array<{ nome?: string; dose?: string; horario?: string }>;
  pedidos?: string[]; exame?: { nome?: string; local?: string; tipo?: string };
};

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function lerComClaude(bytes: Uint8Array, mime: string): Promise<Lido> {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY ausente");
  const bloco = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64(bytes) } }
    : { type: "image", source: { type: "base64", media_type: mime, data: b64(bytes) } };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1500,
      system: INSTRUCAO,
      messages: [{ role: "user", content: [bloco, { type: "text", text: "Leia este documento e responda só com o JSON." }] }],
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`claude ${r.status}: ${txt.slice(0, 300)}`);
  const resp = JSON.parse(txt);
  const texto = (resp.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const ini = texto.indexOf("{"), fim = texto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("resposta sem JSON");
  return JSON.parse(texto.slice(ini, fim + 1));
}

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function ler(admin: SupabaseClient, userId: string, id: string) {
  const { data: doc, error } = await admin.from("saude_documentos").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error || !doc) return json({ error: "Documento não encontrado" }, 404);
  const caminho = doc.arquivo_tipo === "pdf" ? doc.original_path : (doc.leitura_path || doc.original_path);
  if (!caminho) return json({ error: "Arquivo não encontrado" }, 404);
  const { data: blob, error: dlErr } = await admin.storage.from(INBOX).download(caminho);
  if (dlErr || !blob) return json({ error: "Não consegui abrir o arquivo" }, 500);
  const mime = doc.arquivo_tipo === "pdf" ? "application/pdf" : (blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg");

  let lido: Lido;
  try {
    lido = await lerComClaude(new Uint8Array(await blob.arrayBuffer()), mime);
  } catch (e) {
    console.error("saude-documento ler:", erroMsg(e));
    await admin.from("saude_documentos").update({ leitura: "erro" }).eq("id", id);
    return json({ ok: false, error: "Não consegui ler o documento" }, 200);
  }

  const categoria = ["receita", "pedido", "exame"].includes(s(lido.categoria)) ? s(lido.categoria) : doc.categoria;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(s(lido.data)) ? s(lido.data) : null;
  const remedios = (Array.isArray(lido.remedios) ? lido.remedios : [])
    .filter((m) => s(m?.nome)).map((m) => ({ nome: s(m.nome), dose: s(m.dose), horario: s(m.horario) }));
  const pedidos = (Array.isArray(lido.pedidos) ? lido.pedidos : []).map(s).filter(Boolean);
  const ex = lido.exame ?? {};
  const campos = {
    categoria,
    medico: s(lido.medico),
    crm: s(lido.crm),
    data,
    exame_nome: s(ex.nome),
    local: s(ex.local),
    exame_tipo: s(ex.tipo) === "img" ? "img" : "lab",
    remedios: categoria === "receita" ? remedios : [],
    pedidos: categoria === "pedido" ? pedidos : [],
    leitura: "pronto",
  };
  await admin.from("saude_documentos").update(campos).eq("id", id);
  if (doc.leitura_path) {
    await admin.storage.from(INBOX).remove([doc.leitura_path]);
    await admin.from("saude_documentos").update({ leitura_path: null }).eq("id", id);
  }
  return json({ ok: true, documento: { ...campos, remedios: categoria === "receita" ? remedios : [] } });
}

// ---------------------------------------------------------------------------
// Google Drive

let token: { v: string; ate: number } | null = null;
async function tokenDrive(): Promise<string> {
  if (token && token.ate > Date.now() + 60_000) return token.v;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: DRIVE_CLIENT_ID, client_secret: DRIVE_CLIENT_SECRET, refresh_token: DRIVE_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(`google token ${r.status}${d?.error ? ` (${d.error})` : ""}`);
  token = { v: d.access_token, ate: Date.now() + (Number(d.expires_in) || 3000) * 1000 };
  return token.v;
}
const q = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
async function acharUm(t: string, busca: string): Promise<string | null> {
  const u = new URL("https://www.googleapis.com/drive/v3/files");
  u.searchParams.set("q", busca); u.searchParams.set("fields", "files(id)"); u.searchParams.set("pageSize", "1"); u.searchParams.set("spaces", "drive");
  const r = await fetch(u, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error(`drive busca ${r.status}`);
  return (await r.json()).files?.[0]?.id ?? null;
}
const pastas = new Map<string, string>();
async function pasta(t: string, nome: string, pai: string): Promise<string> {
  const k = `${pai}/${nome}`;
  if (pastas.has(k)) return pastas.get(k)!;
  let id = await acharUm(t, `name='${q(nome)}' and mimeType='${FOLDER_MIME}' and '${q(pai)}' in parents and trashed=false`);
  if (!id) {
    const r = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ name: nome, mimeType: FOLDER_MIME, parents: [pai] }),
    });
    if (!r.ok) throw new Error(`drive pasta ${r.status}`);
    id = (await r.json()).id as string;
  }
  pastas.set(k, id);
  return id;
}
async function enviar(t: string, meta: { name: string; parents: string[]; description: string }, corpo: Blob, mime: string): Promise<{ id: string; link: string }> {
  const ini = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(corpo.size) },
    body: JSON.stringify(meta),
  });
  if (!ini.ok) throw new Error(`drive início ${ini.status}`);
  const sessao = ini.headers.get("Location");
  await ini.body?.cancel();
  if (!sessao) throw new Error("drive sem sessão");
  const put = await fetch(sessao, { method: "PUT", headers: { "Content-Type": mime, "Content-Length": String(corpo.size) }, body: corpo });
  if (!put.ok) throw new Error(`drive envio ${put.status}`);
  const d = await put.json();
  return { id: d.id, link: d.webViewLink ?? `https://drive.google.com/file/d/${d.id}/view` };
}
const limpar = (v: string) => v.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

async function paraDrive(admin: SupabaseClient, userId: string, id: string): Promise<string> {
  const { data: doc } = await admin.from("saude_documentos").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!doc) return "missing";
  if (doc.drive_file_id) return "already";
  if (!doc.original_path) return "missing";
  if (!(DRIVE_CLIENT_ID && DRIVE_CLIENT_SECRET && DRIVE_REFRESH_TOKEN)) return "sem-drive";
  const { data: blob, error } = await admin.storage.from(INBOX).download(doc.original_path);
  if (error || !blob) throw new Error("inbox download");
  const ext = (doc.original_path.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const mime = doc.arquivo_mime || blob.type || "application/octet-stream";
  const data = doc.data ?? String(doc.created_at).slice(0, 10);
  const quem = doc.categoria === "exame" ? doc.exame_nome : doc.medico;
  const nome = `${data} ${TIPO_NOME[doc.categoria] ?? "Documento"} ${limpar(quem || "sem nome")} ${String(doc.id).slice(0, 8)}.${ext}`;
  const t = await tokenDrive();
  const raiz = await pasta(t, PASTA_RAIZ, "root");
  const destino = await pasta(t, SUBPASTA[doc.categoria] ?? "Outros", raiz);
  const desc = [TIPO_NOME[doc.categoria], quem, doc.crm ? `CRM ${doc.crm}` : "", doc.local, data].filter(Boolean).join(" · ");
  const existe = await acharUm(t, `name='${q(nome)}' and '${q(destino)}' in parents and trashed=false`);
  const up = existe ? { id: existe, link: `https://drive.google.com/file/d/${existe}/view` } : await enviar(t, { name: nome, parents: [destino], description: desc }, blob, mime);
  await admin.from("saude_documentos").update({ drive_file_id: up.id, drive_link: up.link, original_path: null }).eq("id", id);
  await admin.storage.from(INBOX).remove([doc.original_path]);
  return "saved";
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  let body: { action?: string; id?: string; user_id?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Login necessário" }, 401);

  let userId: string;
  const TESTE = Deno.env.get("SAUDE_TESTE") ?? "";
  if (TESTE.length >= 32 && req.headers.get("x-saude-teste") === TESTE && body.user_id) {
    userId = body.user_id; // só para testes; o segredo SAUDE_TESTE é apagado depois
  } else {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: { user }, error } = await userClient.auth.getUser(jwt);
    if (error || !user) return json({ error: "Login inválido" }, 401);
    if ((user.email ?? "").toLowerCase() !== DONO) return json({ error: "Sem acesso" }, 403);
    userId = user.id;
  }

  const id = body.id;
  if (id !== undefined && (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) return json({ error: "id inválido" }, 400);

  try {
    if (body.action === "ler" && id) return await ler(admin, userId, id);
    if (body.action === "drive" && id) return json({ ok: true, status: await paraDrive(admin, userId, id) });
    if (body.action === "pendentes") {
      const { data } = await admin.from("saude_documentos").select("id").eq("user_id", userId).eq("confirmado", true)
        .not("original_path", "is", null).is("drive_file_id", null).limit(10);
      const res: Record<string, number> = {};
      for (const d of data ?? []) {
        try { const st = await paraDrive(admin, userId, d.id); res[st] = (res[st] ?? 0) + 1; }
        catch (e) { console.error("saude-documento drive:", d.id, erroMsg(e)); res.error = (res.error ?? 0) + 1; }
      }
      return json({ ok: true, ...res });
    }
    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("saude-documento:", erroMsg(e));
    return json({ ok: false, error: "Erro interno" }, 500);
  }
});
