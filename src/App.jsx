import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, DONO } from "./supabase.js";

/* ---------------- ícones ---------------- */
const P = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  doc: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
  pill: <><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M8.5 8.5l7 7" /></>,
  flask: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" /><path d="M7.5 15h9" /></>,
  heart: <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2 5 5 0 0 0-8.8 3.2c0 5.4 8.8 11.4 8.8 11.4s8.8-6 8.8-11.4z" />,
  camera: <><path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="4" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="1.5" /><path d="M6 14h12v7H6z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5 9-10" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  ext: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  logout: <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
};
const Ic = ({ n, s = 28, w = 2 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>
);
const Google = () => (
  <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);

/* ---------------- utilidades ---------------- */
const pad = (n) => String(n).padStart(2, "0");
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtData = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const TIPO = { receita: "Receita", pedido: "Pedido de exame", exame: "Exame" };
const HORARIOS = ["Manhã", "Tarde", "Noite", "Antes de dormir", "12 em 12 h", "8 em 8 h", "Se tiver dor"];
const porData = (a, b) => (b.data || "").localeCompare(a.data || "") || (b.created_at || "").localeCompare(a.created_at || "");

async function paraJpeg(file, max, qualidade = 0.86) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", qualidade));
  } finally { URL.revokeObjectURL(url); }
}
async function capaDoPdf(file, max) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await pdf.getPage(1);
  const v0 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: max / Math.max(v0.width, v0.height) });
  const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.85));
}
const extDe = (file) => {
  const m = /\.([a-z0-9]{2,5})$/i.exec(file.name || "");
  if (m) return m[1].toLowerCase();
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif", "image/webp": "webp", "application/pdf": "pdf" })[file.type] || "jpg";
};

/* ---------------- app ---------------- */
export default function App() {
  const [sessao, setSessao] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  if (sessao === undefined) return <p className="loading">Abrindo…</p>;
  if (!sessao) return <Entrar />;
  if ((sessao.user.email || "").toLowerCase() !== DONO) return <SemAcesso email={sessao.user.email} />;
  return <Principal user={sessao.user} />;
}

function Entrar() {
  const [busy, setBusy] = useState(false);
  const entrar = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) setBusy(false);
  };
  return (
    <div className="login s-rec">
      <img src="/logo.png" alt="Saúde Repositório" />
      <button className="primary" onClick={entrar} disabled={busy} style={{ background: "var(--card)", color: "var(--ink)", border: "1.5px solid var(--line)" }}>
        <Google /> {busy ? "Abrindo o Google…" : "Entrar com Google"}
      </button>
    </div>
  );
}
function SemAcesso({ email }) {
  return (
    <div className="login">
      <img src="/logo.png" alt="Saúde Repositório" />
      <p className="note">A conta {email} não tem acesso a este app.</p>
      <button className="ghost" style={{ maxWidth: 360 }} onClick={() => supabase.auth.signOut()}><Ic n="logout" s={22} /> Sair e usar outra conta</button>
    </div>
  );
}

function Principal({ user }) {
  const [view, setView] = useState("home");
  const [prev, setPrev] = useState("home");
  const [dados, setDados] = useState({ docs: [], remedios: [], doencas: [], cirurgias: [], perfil: null, ok: false });
  const [urls, setUrls] = useState({});
  const [filtro, setFiltro] = useState({ rec: "todos", med: "uso", exa: "todos" });
  const [detalhe, setDetalhe] = useState(null);
  const [folha, setFolha] = useState(null);
  const [novo, setNovo] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const pickRef = useRef(null);
  const pickFor = useRef("auto");
  const toastT = useRef(0);

  const toast = useCallback((m) => { setToastMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(""), 3000); }, []);

  const carregar = useCallback(async () => {
    const [d, r, dz, cz, pf] = await Promise.all([
      supabase.from("saude_documentos").select("*").eq("confirmado", true).order("created_at", { ascending: false }),
      supabase.from("saude_remedios").select("*").order("nome"),
      supabase.from("saude_doencas").select("*").order("nome"),
      supabase.from("saude_cirurgias").select("*").order("ano", { ascending: false }),
      supabase.from("saude_perfil").select("*").maybeSingle(),
    ]);
    if (d.error) { toast("Não consegui carregar os dados. Puxe para atualizar."); return; }
    setDados({ docs: d.data || [], remedios: r.data || [], doencas: dz.data || [], cirurgias: cz.data || [], perfil: pf.data || null, ok: true });
  }, [toast]);

  useEffect(() => {
    carregar();
    supabase.functions.invoke("saude-documento", { body: { action: "pendentes" } }).catch(() => {});
    // Limpa rascunhos abandonados (foto enviada mas não salva) com mais de 1 hora.
    (async () => {
      const limite = new Date(Date.now() - 3600_000).toISOString();
      const { data } = await supabase.from("saude_documentos").select("id, miniatura_path, original_path, leitura_path").eq("confirmado", false).lt("created_at", limite);
      for (const d of data || []) await apagarDoc(d, true);
    })();
  }, [carregar]);

  // Miniaturas privadas: URL assinada por 1 hora.
  useEffect(() => {
    const faltam = dados.docs.map((d) => d.miniatura_path).filter((p) => p && !urls[p]);
    if (!faltam.length) return;
    supabase.storage.from("saude-miniaturas").createSignedUrls(faltam, 3600).then(({ data }) => {
      if (!data) return;
      setUrls((u) => { const n = { ...u }; data.forEach((x) => { if (x.signedUrl) n[x.path] = x.signedUrl; }); return n; });
    });
  }, [dados.docs]); // eslint-disable-line

  const ir = (v) => { if (view !== "novo") setPrev(view); setView(v); setDetalhe(null); setFolha(null); window.scrollTo(0, 0); };

  /* ---------- novo documento ---------- */
  const escolher = (para) => { pickFor.current = para; if (pickRef.current) { pickRef.current.value = ""; pickRef.current.click(); } };

  async function comecar(file, preset) {
    if (!file) return;
    const ehPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    const ehImg = (file.type || "").startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name || "");
    if (!ehPdf && !ehImg) { toast("Envie uma foto ou um PDF."); return; }
    if (file.size > 30 * 1024 * 1024) { toast("Arquivo grande demais (máximo 30 MB)."); return; }
    const id = crypto.randomUUID();
    const n = { id, ehPdf, previewUrl: "", status: "preparando", erro: "", salvando: false,
      form: { categoria: preset === "exame" ? "exame" : "receita", medico: "", crm: "", data: "", exame_nome: "", local: "", exame_tipo: "lab" },
      remedios: [], pedidos: [], paths: {} };
    setNovo(n); if (view !== "novo") setPrev(view); setView("novo"); setDetalhe(null); window.scrollTo(0, 0);
    try {
      const uid = user.id;
      const miniatura = ehPdf ? await capaDoPdf(file, 700) : await paraJpeg(file, 700, 0.8);
      const leitura = ehPdf ? null : await paraJpeg(file, 2000);
      const original = file;
      const ext = ehPdf ? "pdf" : extDe(file);
      const paths = { miniatura_path: `${uid}/${id}.jpg`, original_path: `${uid}/${id}.${ext}`, leitura_path: leitura ? `${uid}/${id}-ler.jpg` : null };
      setNovo((x) => x && x.id === id ? { ...x, previewUrl: URL.createObjectURL(miniatura), status: "enviando", paths } : x);
      const up1 = await supabase.storage.from("saude-miniaturas").upload(paths.miniatura_path, miniatura, { contentType: "image/jpeg" });
      const up2 = await supabase.storage.from("saude-inbox").upload(paths.original_path, original, { contentType: ehPdf ? "application/pdf" : (file.type || "image/jpeg") });
      const up3 = leitura ? await supabase.storage.from("saude-inbox").upload(paths.leitura_path, leitura, { contentType: "image/jpeg" }) : { error: null };
      if (up1.error || up2.error || up3.error) throw new Error("upload");
      const ins = await supabase.from("saude_documentos").insert({ id, categoria: n.form.categoria, arquivo_tipo: ehPdf ? "pdf" : "img", arquivo_mime: ehPdf ? "application/pdf" : (file.type || "image/jpeg"), ...paths, leitura: "lendo" });
      if (ins.error) throw new Error("insert");
      setNovo((x) => x && x.id === id ? { ...x, status: "lendo" } : x);
      const { data, error } = await supabase.functions.invoke("saude-documento", { body: { action: "ler", id } });
      if (error || !data?.ok) { setNovo((x) => x && x.id === id ? { ...x, status: "manual" } : x); return; }
      const d = data.documento;
      setNovo((x) => {
        if (!x || x.id !== id) return x;
        const f = { ...x.form };
        for (const k of ["categoria", "medico", "crm", "exame_nome", "local", "exame_tipo"]) if (d[k] && !f[k + "_tocado"]) f[k] = d[k];
        if (d.data) f.data = d.data;
        return { ...x, form: f, status: "pronto", remedios: (d.remedios || []).map((m) => ({ ...m, add: true })), pedidos: d.pedidos || [] };
      });
    } catch (e) {
      setNovo((x) => x && x.id === id ? { ...x, status: "erro", erro: "Não consegui enviar o arquivo. Confira a internet e tente de novo." } : x);
    }
  }

  async function salvarNovo() {
    const n = novo; if (!n || n.salvando) return;
    const f = n.form;
    setNovo({ ...n, salvando: true });
    const patch = { categoria: f.categoria, medico: f.medico.trim(), crm: f.crm.trim(), data: f.data || null,
      exame_nome: f.exame_nome.trim(), local: f.local.trim(), exame_tipo: f.exame_tipo,
      remedios: f.categoria === "receita" ? n.remedios.map(({ nome, dose, horario }) => ({ nome, dose, horario })) : [],
      pedidos: f.categoria === "pedido" ? n.pedidos : [], confirmado: true };
    const { error } = await supabase.from("saude_documentos").update(patch).eq("id", n.id);
    if (error) { setNovo({ ...n, salvando: false }); toast("Não deu para salvar. Tente de novo."); return; }
    const add = f.categoria === "receita" ? n.remedios.filter((m) => m.add && m.nome) : [];
    if (add.length) await supabase.from("saude_remedios").insert(add.map((m) => ({ nome: m.nome, dose: m.dose, horario: m.horario, inicio: f.data || hoje(), documento_id: n.id })));
    supabase.functions.invoke("saude-documento", { body: { action: "drive", id: n.id } }).catch(() => {});
    if (n.previewUrl) URL.revokeObjectURL(n.previewUrl);
    setNovo(null);
    setFiltro((x) => ({ ...x, rec: "todos", exa: "todos" }));
    setView(f.categoria === "exame" ? "exames" : "receitas");
    toast(add.length ? `Salvo. ${add.length} remédio${add.length > 1 ? "s" : ""} na sua lista.` : "Salvo");
    carregar();
  }

  async function apagarDoc(d, silencioso) {
    const inbox = [d.original_path, d.leitura_path].filter(Boolean);
    if (inbox.length) await supabase.storage.from("saude-inbox").remove(inbox);
    if (d.miniatura_path) await supabase.storage.from("saude-miniaturas").remove([d.miniatura_path]);
    await supabase.from("saude_documentos").delete().eq("id", d.id);
    if (!silencioso) { toast("Apagado"); carregar(); }
  }

  async function cancelarNovo() {
    const n = novo;
    setNovo(null); ir(prev && prev !== "novo" ? prev : "home");
    if (n && n.paths && n.paths.miniatura_path) apagarDoc({ id: n.id, ...n.paths }, true);
    if (n?.previewUrl) URL.revokeObjectURL(n.previewUrl);
  }

  // Arrastar arquivo (Mac): solta em qualquer lugar.
  useEffect(() => {
    let depth = 0;
    const tem = (e) => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const enter = (e) => { if (tem(e)) { depth++; document.body.classList.add("dragging"); } };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove("dragging"); };
    const over = (e) => { if (tem(e)) e.preventDefault(); };
    const drop = (e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); depth = 0; document.body.classList.remove("dragging"); comecar(e.dataTransfer.files[0], view === "exames" ? "exame" : "auto"); };
    document.addEventListener("dragenter", enter); document.addEventListener("dragleave", leave);
    document.addEventListener("dragover", over); document.addEventListener("drop", drop);
    return () => { document.removeEventListener("dragenter", enter); document.removeEventListener("dragleave", leave); document.removeEventListener("dragover", over); document.removeEventListener("drop", drop); };
  });

  /* ---------- remédios ---------- */
  const parar = async (r) => { await supabase.from("saude_remedios").update({ ativo: false, parou_em: hoje() }).eq("id", r.id); toast("Movido para “Já usei”"); carregar(); };
  const voltar = async (r) => { await supabase.from("saude_remedios").update({ ativo: true, parou_em: null }).eq("id", r.id); toast("De volta para “Em uso”"); carregar(); };

  const ctx = { user, dados, urls, filtro, setFiltro, ir, escolher, toast, carregar, setDetalhe, setFolha, parar, voltar, apagarDoc };

  let tela;
  if (view === "novo") tela = <Novo n={novo} setN={setNovo} salvar={salvarNovo} cancelar={cancelarNovo} escolher={escolher} />;
  else if (detalhe) tela = <Detalhe {...ctx} doc={dados.docs.find((d) => d.id === detalhe)} fechar={() => setDetalhe(null)} />;
  else if (view === "receitas") tela = <Receitas {...ctx} />;
  else if (view === "remedios") tela = <Remedios {...ctx} />;
  else if (view === "exames") tela = <Exames {...ctx} />;
  else if (view === "historico") tela = <Historico {...ctx} />;
  else if (view === "resumo") tela = <Resumo {...ctx} voltarPara={prev === "resumo" ? "home" : prev} />;
  else tela = <Home {...ctx} />;

  return (
    <>
      <input ref={pickRef} type="file" accept="image/*,application/pdf" className="sr" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) comecar(f, pickFor.current); }} />
      {tela}
      {view !== "novo" && <Abas view={detalhe ? "" : view} ir={ir} />}
      {folha && <Folha folha={folha} setFolha={setFolha} dados={dados} toast={toast} carregar={carregar} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}

/* ---------------- componentes ---------------- */
function Cab({ titulo, ir, voltarPara = "home", direita, onVoltar, fechar }) {
  return (
    <header className="hdr">
      <button className="iconbtn" onClick={onVoltar || (() => ir(voltarPara))} aria-label="Voltar"><Ic n={fechar ? "close" : "back"} s={26} w={2.2} /></button>
      <h1 className="grow">{titulo}</h1>{direita}
    </header>
  );
}
function Chips({ k, filtro, setFiltro, opcoes }) {
  return <div className="chips" role="group">{opcoes.map(([v, l]) =>
    <button key={v} className="chip" aria-pressed={filtro[k] === v} onClick={() => setFiltro((x) => ({ ...x, [k]: v }))}>{l}</button>)}</div>;
}
function Vazio({ icon, titulo, texto, children }) {
  return <div className="empty"><div className="ico"><Ic n={icon} s={32} /></div><b>{titulo}</b><p>{texto}</p>{children}</div>;
}
function Miniatura({ doc, urls, icon }) {
  const u = doc.miniatura_path && urls[doc.miniatura_path];
  return <div className="thumb">{u ? <img src={u} alt="" loading="lazy" /> : <Ic n={icon} s={28} w={1.8} />}</div>;
}
function DocItem({ d, urls, abrir }) {
  const ex = d.categoria === "exame";
  return (
    <button className={`item ${ex || d.categoria === "pedido" ? "s-exa" : "s-rec"}`} onClick={() => abrir(d.id)}>
      <Miniatura doc={d} urls={urls} icon={ex ? "flask" : "doc"} />
      <div className="body">
        <span className="badge">{ex ? (d.exame_tipo === "img" ? "Imagem" : "Laboratório") : TIPO[d.categoria]}</span>
        <span className="t1">{ex ? (d.exame_nome || "Exame") : (d.medico || "Médico não informado")}</span>
        {ex ? (d.local && <span className="t2">{d.local}</span>) : (d.crm && <span className="t2">CRM {d.crm}</span>)}
        <span className="t2"><b>{fmtData(d.data) || "Sem data"}</b></span>
      </div>
    </button>
  );
}
function Abas({ view, ir }) {
  const t = (v, icon, label, cls) => (
    <button key={v} className={`tab ${cls}`} onClick={() => ir(v)} aria-current={view === v ? "page" : undefined}><Ic n={icon} s={28} />{label}</button>
  );
  return <nav className="tabs no-print" aria-label="Seções"><div className="in">
    {t("home", "home", "Início", "s-rec")}{t("receitas", "doc", "Receitas", "s-rec")}{t("remedios", "pill", "Remédios", "s-med")}{t("exames", "flask", "Exames", "s-exa")}{t("historico", "heart", "Histórico", "s-his")}
  </div></nav>;
}

function Home({ dados, urls, ir, escolher, setDetalhe }) {
  const nome = (dados.perfil?.nome || "").trim().split(/\s+/)[0];
  const receitas = dados.docs.filter((d) => d.categoria !== "exame");
  const exames = dados.docs.filter((d) => d.categoria === "exame");
  const ativos = dados.remedios.filter((r) => r.ativo).length;
  const ult = dados.docs[0];
  const tile = (cls, v, icon, n, t, s) => (
    <button className={`tile ${cls}`} onClick={() => ir(v)}>
      <div className="top"><div className="ico"><Ic n={icon} s={34} /></div><span className="count">{n}</span></div>
      <div><b>{t}</b><small>{s}</small></div>
    </button>
  );
  return (
    <div className="wrap">
      <header className="hdr">
        <img className="brand" src="/emblema.png" alt="Saúde Repositório" width="60" height="60" />
        <div className="grow"><div className="hello">{nome ? `Olá, ${nome}` : "Olá"}</div><h1>Minha saúde</h1></div>
        <button className="iconbtn" onClick={() => ir("resumo")} aria-label="Resumo para o médico"><Ic n="print" /></button>
      </header>
      <button className="big-add" onClick={() => escolher("auto")}>
        <span className="bx"><Ic n="camera" s={34} /></span>
        <span><b>Adicionar documento</b><span>Foto ou arquivo. O app lê sozinho.</span></span>
      </button>
      <div className="tiles">
        {tile("s-rec", "receitas", "doc", receitas.length, "Receitas", "e pedidos")}
        {tile("s-med", "remedios", "pill", ativos, "Remédios", "em uso")}
        {tile("s-exa", "exames", "flask", exames.length, "Exames", "labs e hospitais")}
        {tile("s-his", "historico", "heart", dados.doencas.length + dados.cirurgias.length, "Histórico", "doenças e cirurgias")}
      </div>
      {ult && <><h2>Último adicionado</h2><DocItem d={ult} urls={urls} abrir={setDetalhe} /></>}
    </div>
  );
}

function Receitas({ dados, urls, filtro, setFiltro, ir, escolher, setDetalhe }) {
  const f = filtro.rec;
  const lista = dados.docs.filter((d) => d.categoria !== "exame" && (f === "todos" || d.categoria === f)).sort(porData);
  return (
    <div className="wrap s-rec">
      <Cab titulo="Receitas" ir={ir} direita={<button className="iconbtn prim" onClick={() => escolher("auto")} aria-label="Adicionar receita ou pedido"><Ic n="plus" s={30} w={2.4} /></button>} />
      <Chips k="rec" filtro={filtro} setFiltro={setFiltro} opcoes={[["todos", "Todos"], ["receita", "Receitas"], ["pedido", "Pedidos"]]} />
      {!dados.ok ? <p className="loading">Carregando…</p> : lista.length
        ? <div className="list">{lista.map((d) => <DocItem key={d.id} d={d} urls={urls} abrir={setDetalhe} />)}</div>
        : <Vazio icon="doc" titulo="Nenhum documento" texto="Tire uma foto da receita ou do pedido. O app preenche médico, CRM e data.">
            <button className="primary" onClick={() => escolher("auto")}><Ic n="camera" s={24} /> Adicionar</button>
          </Vazio>}
    </div>
  );
}

function Exames({ dados, urls, filtro, setFiltro, ir, escolher, setDetalhe }) {
  const f = filtro.exa;
  const lista = dados.docs.filter((d) => d.categoria === "exame" && (f === "todos" || d.exame_tipo === f)).sort(porData);
  return (
    <div className="wrap s-exa">
      <Cab titulo="Exames" ir={ir} />
      <button className="drop" onClick={() => escolher("exame")}><Ic n="upload" s={30} /> Adicionar PDF ou foto do exame</button>
      <Chips k="exa" filtro={filtro} setFiltro={setFiltro} opcoes={[["todos", "Todos"], ["lab", "Laboratório"], ["img", "Imagem"]]} />
      {!dados.ok ? <p className="loading">Carregando…</p> : lista.length
        ? <div className="list">{lista.map((d) => <DocItem key={d.id} d={d} urls={urls} abrir={setDetalhe} />)}</div>
        : <Vazio icon="flask" titulo="Nenhum exame" texto="Envie o PDF do laboratório ou do hospital. No Mac, dá para arrastar o arquivo para cá." />}
    </div>
  );
}

function Remedios({ dados, filtro, setFiltro, ir, setFolha, parar, voltar }) {
  const uso = filtro.med === "uso";
  const lista = dados.remedios.filter((r) => r.ativo === uso);
  return (
    <div className="wrap s-med">
      <Cab titulo="Remédios" ir={ir} direita={<button className="iconbtn prim" onClick={() => setFolha({ k: "remedio" })} aria-label="Adicionar remédio"><Ic n="plus" s={30} w={2.4} /></button>} />
      <Chips k="med" filtro={filtro} setFiltro={setFiltro} opcoes={[["uso", "Em uso"], ["antes", "Já usei"]]} />
      {!dados.ok ? <p className="loading">Carregando…</p> : lista.length ? (
        <div className="list">{lista.map((r) => (
          <div key={r.id} className="item s-med">
            <button className="ico md" onClick={() => setFolha({ k: "remedio", item: r })} aria-label={`Editar ${r.nome}`}><Ic n="pill" s={30} /></button>
            <button className="body" onClick={() => setFolha({ k: "remedio", item: r })}>
              <span className="t1">{r.nome}</span>
              {r.dose && <span className="t2"><b>{r.dose}</b></span>}
              <span className="t2" style={{ display: "flex", gap: 6, alignItems: "center" }}><Ic n="clock" s={16} w={2.2} /> {r.ativo ? (r.horario || "Sem horário") : `Parou em ${fmtData(r.parou_em) || "—"}`}</span>
            </button>
            <button className="mini" onClick={() => (r.ativo ? parar(r) : voltar(r))}>{r.ativo ? "Parei" : "Voltei"}</button>
          </div>
        ))}</div>
      ) : uso ? (
        <Vazio icon="pill" titulo="Nenhum remédio em uso" texto="Adicione à mão ou salve uma receita: os remédios dela entram aqui.">
          <button className="primary" onClick={() => setFolha({ k: "remedio" })}><Ic n="plus" s={24} /> Adicionar remédio</button>
        </Vazio>
      ) : <Vazio icon="pill" titulo="Nada por aqui" texto="Quando você tocar em “Parei” num remédio, ele aparece aqui." />}
    </div>
  );
}

function Historico({ dados, ir, setFolha }) {
  const sec = (titulo, k, label) => (
    <div className="hdr" style={{ paddingTop: 4 }}><h2 className="grow">{titulo}</h2>
      <button className="iconbtn sm" onClick={() => setFolha({ k })} aria-label={label}><Ic n="plus" s={22} w={2.4} /></button></div>
  );
  return (
    <div className="wrap s-his">
      <Cab titulo="Histórico" ir={ir} />
      {sec("Doenças atuais", "doenca", "Adicionar doença")}
      {dados.doencas.length ? <div className="list">{dados.doencas.map((d) => (
        <button key={d.id} className="item" onClick={() => setFolha({ k: "doenca", item: d })}>
          <div className="ico md"><Ic n="heart" s={28} /></div>
          <div className="body"><span className="t1">{d.nome}</span>{d.desde && <span className="t2">Desde {d.desde}</span>}</div>
        </button>))}</div> : <p className="note">Nenhuma doença cadastrada.</p>}
      {sec("Operações", "cirurgia", "Adicionar operação")}
      {dados.cirurgias.length ? <div className="list">{dados.cirurgias.map((c) => (
        <button key={c.id} className="item" onClick={() => setFolha({ k: "cirurgia", item: c })}>
          <div className="yr">{c.ano || "—"}</div>
          <div className="body"><span className="t1">{c.nome}</span>{c.hospital && <span className="t2">{c.hospital}</span>}</div>
        </button>))}</div> : <p className="note">Nenhuma operação cadastrada.</p>}
      <button className="primary dark" style={{ marginTop: 8 }} onClick={() => ir("resumo")}><Ic n="print" s={26} /> Resumo para o médico</button>
    </div>
  );
}

function Novo({ n, setN, salvar, cancelar, escolher }) {
  if (!n) return null;
  const f = n.form, cat = f.categoria;
  const set = (k, v) => setN((x) => ({ ...x, form: { ...x.form, [k]: v, [k + "_tocado"]: true } }));
  const fld = (id, label, type = "text", ph = "") => (
    <div className="fld"><label htmlFor={`f-${id}`}>{label}</label>
      <input id={`f-${id}`} type={type} value={f[id] || ""} placeholder={ph} autoComplete="off" onChange={(e) => set(id, e.target.value)} /></div>
  );
  const seg = (k, v, l) => <button key={v} aria-pressed={f[k] === v} onClick={() => set(k, v)}>{l}</button>;
  let st = null;
  if (n.status === "preparando" || n.status === "enviando") st = <span className="pill"><span className="spin" /> Enviando…</span>;
  else if (n.status === "lendo") st = <span className="pill"><span className="spin" /> Lendo o documento…</span>;
  else if (n.status === "pronto") st = <span className="pill"><Ic n="check" s={16} w={2.6} /> Lido automaticamente</span>;
  else if (n.status === "manual") st = <span className="pill"><Ic n="edit" s={16} w={2.2} /> Não consegui ler. Preencha</span>;
  const pronto = ["pronto", "manual"].includes(n.status);
  return (
    <div className={`wrap ${cat === "exame" ? "s-exa" : "s-rec"}`} style={{ paddingBottom: 40 }}>
      <Cab titulo="Novo documento" fechar onVoltar={cancelar} />
      {n.status === "erro" ? <>
        <div className="warnbox">{n.erro}</div>
        <button className="primary" onClick={() => escolher(cat === "exame" ? "exame" : "auto")}><Ic n="upload" s={24} /> Escolher de novo</button>
      </> : <>
        <div className="preview">{n.previewUrl ? <img src={n.previewUrl} alt="Documento enviado" /> : <Ic n={n.ehPdf ? "doc" : "camera"} s={48} w={1.6} />}<div className="status">{st}</div></div>
        <div className="seg" role="group" aria-label="Tipo de documento">{seg("categoria", "receita", "Receita")}{seg("categoria", "pedido", "Pedido")}{seg("categoria", "exame", "Exame")}</div>
        <div className="form">
          {cat === "exame" ? <>
            {fld("exame_nome", "Nome do exame", "text", "Ex.: Hemograma completo")}
            {fld("local", "Laboratório ou hospital")}
            <div className="row2">{fld("data", "Data", "date")}
              <div className="fld"><label>Tipo</label><div className="seg" style={{ padding: 3 }}>{seg("exame_tipo", "lab", "Lab")}{seg("exame_tipo", "img", "Imagem")}</div></div></div>
          </> : <>
            {fld("medico", "Médico", "text", "Dr. ou Dra.")}
            <div className="row2">{fld("crm", "CRM", "text", "UF 000000")}{fld("data", "Data", "date")}</div>
          </>}
        </div>
        {cat === "receita" && n.remedios.length > 0 && <>
          <h2>Adicionar à lista de remédios</h2>
          <div className="list s-med">{n.remedios.map((m, i) => (
            <button key={i} className="check" aria-pressed={m.add} onClick={() => setN((x) => ({ ...x, remedios: x.remedios.map((r, j) => (j === i ? { ...r, add: !r.add } : r)) }))}>
              <span className="box">{m.add && <Ic n="check" s={18} w={3} />}</span>
              <span style={{ display: "flex", flexDirection: "column" }}><span className="t1" style={{ fontSize: 16 }}>{m.nome}</span>
                <span className="t2">{[m.dose, m.horario].filter(Boolean).join(" · ")}</span></span>
            </button>))}</div>
        </>}
        {cat === "pedido" && n.pedidos.length > 0 && <><h2>Exames pedidos</h2>
          <div className="chips">{n.pedidos.map((p, i) => <span key={i} className="badge s-exa" style={{ fontSize: 14, padding: "6px 12px" }}>{p}</span>)}</div></>}
        <button className="primary" onClick={salvar} disabled={!pronto || n.salvando}>
          {n.salvando ? <><span className="spin" /> Salvando…</> : pronto ? <><Ic n="check" s={26} w={2.6} /> Salvar</> : <><span className="spin" /> Aguarde a leitura…</>}
        </button>
      </>}
    </div>
  );
}

function Detalhe({ doc, urls, fechar, toast, carregar, apagarDoc }) {
  const [f, setF] = useState(() => doc ? { categoria: doc.categoria, medico: doc.medico, crm: doc.crm, data: doc.data || "", exame_nome: doc.exame_nome, local: doc.local, exame_tipo: doc.exame_tipo } : null);
  const [armado, setArmado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [original, setOriginal] = useState(doc?.drive_link || "");
  useEffect(() => {
    if (doc && !doc.drive_link && doc.original_path)
      supabase.storage.from("saude-inbox").createSignedUrl(doc.original_path, 3600).then(({ data }) => data && setOriginal(data.signedUrl));
  }, [doc]);
  if (!doc || !f) return <div className="wrap"><Cab titulo="Documento" onVoltar={fechar} /><p className="note">Este item foi apagado.</p></div>;
  const ex = f.categoria === "exame";
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const fld = (id, label, type = "text") => (
    <div className="fld"><label htmlFor={`d-${id}`}>{label}</label><input id={`d-${id}`} type={type} value={f[id] || ""} autoComplete="off" onChange={(e) => set(id, e.target.value)} /></div>
  );
  const seg = (k, v, l) => <button key={v} aria-pressed={f[k] === v} onClick={() => set(k, v)}>{l}</button>;
  const salvar = async () => {
    setSalvando(true);
    const { error } = await supabase.from("saude_documentos").update({ ...f, data: f.data || null, medico: f.medico.trim(), crm: f.crm.trim(), exame_nome: f.exame_nome.trim(), local: f.local.trim() }).eq("id", doc.id);
    setSalvando(false);
    if (error) { toast("Não deu para salvar. Tente de novo."); return; }
    toast("Alterações salvas"); fechar(); carregar();
  };
  const apagar = async () => { if (!armado) { setArmado(true); return; } await apagarDoc(doc); fechar(); };
  const mini = doc.miniatura_path && urls[doc.miniatura_path];
  return (
    <div className={`wrap ${ex || f.categoria === "pedido" ? "s-exa" : "s-rec"}`}>
      <Cab titulo={ex ? "Exame" : TIPO[f.categoria]} onVoltar={fechar} />
      <div className="detail-img">{mini ? <img src={mini} alt="Documento" /> : <Ic n="doc" s={48} w={1.6} />}</div>
      {original && <a className="linkbtn" href={original} target="_blank" rel="noopener"><Ic n="ext" s={20} /> {doc.drive_link ? "Abrir o original no Google Drive" : `Abrir ${doc.arquivo_tipo === "pdf" ? "o PDF" : "a foto"} original`}</a>}
      <div className="seg">{seg("categoria", "receita", "Receita")}{seg("categoria", "pedido", "Pedido")}{seg("categoria", "exame", "Exame")}</div>
      <div className="form">
        {ex ? <>{fld("exame_nome", "Nome do exame")}{fld("local", "Laboratório ou hospital")}
          <div className="row2">{fld("data", "Data", "date")}<div className="fld"><label>Tipo</label><div className="seg" style={{ padding: 3 }}>{seg("exame_tipo", "lab", "Lab")}{seg("exame_tipo", "img", "Imagem")}</div></div></div></>
          : <>{fld("medico", "Médico")}<div className="row2">{fld("crm", "CRM")}{fld("data", "Data", "date")}</div></>}
      </div>
      {!ex && (doc.remedios || []).length > 0 && <><h2>Remédios desta receita</h2><ul style={{ margin: 0, paddingLeft: 20 }}>{doc.remedios.map((m, i) => <li key={i}><b>{m.nome}</b> {[m.dose, m.horario].filter(Boolean).join(" · ")}</li>)}</ul></>}
      {!ex && (doc.pedidos || []).length > 0 && <><h2>Exames pedidos</h2><div className="chips">{doc.pedidos.map((p, i) => <span key={i} className="badge s-exa" style={{ fontSize: 14, padding: "6px 12px" }}>{p}</span>)}</div></>}
      <button className="primary" onClick={salvar} disabled={salvando}><Ic n="check" s={26} w={2.6} /> Salvar alterações</button>
      <button className={`ghost danger ${armado ? "armed" : ""}`} onClick={apagar}><Ic n="trash" s={22} /> {armado ? "Toque de novo para apagar" : "Apagar"}</button>
      {doc.drive_file_id && <p className="note">Apagar aqui não apaga a cópia guardada no Google Drive.</p>}
    </div>
  );
}

function Resumo({ dados, ir, setFolha, voltarPara }) {
  const p = dados.perfil || {};
  const doencas = dados.doencas;
  const cir = dados.cirurgias;
  const rem = dados.remedios.filter((r) => r.ativo);
  const exames = dados.docs.filter((d) => d.categoria === "exame").sort(porData).slice(0, 8);
  const docs = dados.docs.filter((d) => d.categoria !== "exame").sort(porData).slice(0, 6);
  const ul = (arr, fn, none) => (arr.length ? <ul>{arr.map((x, i) => <li key={i}>{fn(x)}</li>)}</ul> : <p className="none">{none}</p>);
  return (
    <div className="wrap s-rec">
      <div className="no-print"><Cab titulo="Resumo" ir={ir} voltarPara={voltarPara || "home"} /></div>
      <div className="paper">
        <div className="hdr" style={{ padding: 0 }}>
          <img className="paper-logo" src="/emblema.png" alt="" width="56" height="56" />
          <div className="grow"><div className="t1" style={{ fontSize: 20 }}>{p.nome || "Seu nome"}</div><div className="t2">Resumo de saúde · {fmtData(hoje())}</div></div>
          <button className="iconbtn sm no-print" onClick={() => setFolha({ k: "perfil" })} aria-label="Editar seus dados"><Ic n="edit" s={22} /></button>
        </div>
        <dl className="kv"><dt>Nascimento</dt><dd>{fmtData(p.nascimento) || "—"}</dd><dt>Tipo sanguíneo</dt><dd>{p.sangue || "—"}</dd><dt>Alergias</dt><dd>{p.alergias || "—"}</dd></dl>
        <section><h3>Doenças atuais</h3>{ul(doencas, (d) => <><b>{d.nome}</b>{d.desde && ` · desde ${d.desde}`}</>, "Nenhuma cadastrada")}</section>
        <section><h3>Operações</h3>{ul(cir, (c) => <>{c.ano && `${c.ano} · `}<b>{c.nome}</b>{c.hospital && ` · ${c.hospital}`}</>, "Nenhuma cadastrada")}</section>
        <section><h3>Remédios em uso</h3>{ul(rem, (m) => <><b>{m.nome}</b>{m.dose && ` · ${m.dose}`}{m.horario && ` · ${m.horario}`}</>, "Nenhum")}</section>
        <section><h3>Últimos exames</h3>{ul(exames, (e) => <>{fmtData(e.data) || "s/ data"} · <b>{e.exame_nome || "Exame"}</b>{e.local && ` · ${e.local}`}</>, "Nenhum")}</section>
        <section><h3>Últimas receitas e pedidos</h3>{ul(docs, (d) => <>{fmtData(d.data) || "s/ data"} · {TIPO[d.categoria]} · <b>{d.medico || "—"}</b>{d.crm && ` · CRM ${d.crm}`}</>, "Nenhum")}</section>
      </div>
      <button className="primary no-print" onClick={() => window.print()}><Ic n="print" s={26} /> Imprimir</button>
      <button className="ghost no-print" onClick={() => supabase.auth.signOut()}><Ic n="logout" s={22} /> Sair da conta</button>
    </div>
  );
}

const FOLHAS = {
  remedio: { tabela: "saude_remedios", titulo: ["Novo remédio", "Editar remédio"], campos: [["nome", "Nome"], ["dose", "Dose", "Ex.: 50 mg · 1 comprimido"], ["horario", "Quando tomar"]], cls: "s-med" },
  doenca: { tabela: "saude_doencas", titulo: ["Nova doença", "Editar doença"], campos: [["nome", "Doença"], ["desde", "Desde (ano)", "Ex.: 2019", "numeric"]], cls: "s-his" },
  cirurgia: { tabela: "saude_cirurgias", titulo: ["Nova operação", "Editar operação"], campos: [["nome", "Operação"], ["ano", "Ano", "Ex.: 2015", "numeric"], ["hospital", "Hospital"]], cls: "s-his" },
  perfil: { tabela: "saude_perfil", titulo: ["Seus dados", "Seus dados"], campos: [["nome", "Nome completo"], ["nascimento", "Nascimento", "", "date"], ["sangue", "Tipo sanguíneo", "Ex.: O+"], ["alergias", "Alergias", "Ex.: dipirona, ou nenhuma"]], cls: "s-rec" },
};
function Folha({ folha, setFolha, dados, toast, carregar }) {
  const cfg = FOLHAS[folha.k];
  const fonte = folha.k === "perfil" ? (dados.perfil || {}) : (folha.item || {});
  const [f, setF] = useState(() => Object.fromEntries(cfg.campos.map(([id]) => [id, fonte[id] != null ? String(fonte[id]) : ""])));
  const [armado, setArmado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const editando = folha.k === "perfil" || !!folha.item;
  const fechar = () => setFolha(null);
  useEffect(() => { const k = (e) => e.key === "Escape" && fechar(); document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); });
  const salvar = async () => {
    const v = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, String(x || "").trim()]));
    if (folha.k !== "perfil" && !v.nome) { toast("Preencha o nome."); return; }
    if (folha.k === "perfil") v.nascimento = v.nascimento || null;
    setSalvando(true);
    let r;
    if (folha.k === "perfil") {
      const { data: s } = await supabase.auth.getSession();
      r = await supabase.from("saude_perfil").upsert({ user_id: s.session.user.id, ...v, updated_at: new Date().toISOString() });
    }
    else if (folha.item) r = await supabase.from(cfg.tabela).update(v).eq("id", folha.item.id);
    else r = await supabase.from(cfg.tabela).insert(v);
    setSalvando(false);
    if (r.error) { toast("Não deu para salvar. Tente de novo."); return; }
    toast("Salvo"); fechar(); carregar();
  };
  const apagar = async () => {
    if (!armado) { setArmado(true); return; }
    await supabase.from(cfg.tabela).delete().eq("id", folha.item.id);
    toast("Apagado"); fechar(); carregar();
  };
  return (
    <div className="overlay">
      <button className="backdrop" onClick={fechar} aria-label="Fechar" />
      <div className={`sheet ${cfg.cls}`} role="dialog" aria-modal="true" aria-label={cfg.titulo[editando ? 1 : 0]}>
        <div className="grab" />
        <div className="hdr" style={{ padding: 0 }}><h1 className="grow" style={{ fontSize: 24 }}>{cfg.titulo[editando ? 1 : 0]}</h1>
          <button className="iconbtn sm" onClick={fechar} aria-label="Fechar"><Ic n="close" s={22} w={2.2} /></button></div>
        <div className="form">{cfg.campos.map(([id, label, ph, tipo]) => (
          <div className="fld" key={id}><label htmlFor={`s-${id}`}>{label}</label>
            <input id={`s-${id}`} type={tipo === "date" ? "date" : "text"} inputMode={tipo === "numeric" ? "numeric" : undefined} value={f[id]} placeholder={ph || ""} autoComplete="off"
              autoFocus={id === "nome" && !editando} onChange={(e) => setF((x) => ({ ...x, [id]: e.target.value }))} /></div>))}</div>
        {folha.k === "remedio" && <div className="chips">{HORARIOS.map((h) => <button key={h} className="chip" aria-pressed={f.horario === h} onClick={() => setF((x) => ({ ...x, horario: h }))}>{h}</button>)}</div>}
        <button className="primary" onClick={salvar} disabled={salvando}><Ic n="check" s={26} w={2.6} /> Salvar</button>
        {folha.item && <button className={`ghost danger ${armado ? "armed" : ""}`} onClick={apagar}><Ic n="trash" s={22} /> {armado ? "Toque de novo para apagar" : "Apagar"}</button>}
      </div>
    </div>
  );
}
