# Saúde Repositório — regras para trabalhar neste repositório

- Português do Brasil em tudo (código, telas, commits, explicações).
- Feito só com o Claude. Nunca usar o Lovable.
- Telas: poucos cliques, pouco texto, ícones grandes, navegação óbvia. Não mudar o visual sem o Fausto pedir.
- Nunca gravar chave, senha ou token no código nem no git. As chaves ficam em `~/evoque/chaves.env.txt` (só no Mac).

## Onde roda
- Front: Cloudflare Workers, SPA estática de `dist/`, em https://saude.evoque.global.
  Publicar: `python3 ~/mnt/evoque/.ferramentas/saude_publicar.py` (build + deploy).
- Back: Supabase do **gerenciador-casa** (ref `zbntjvgbghftpkwcgasr`), separado por prefixo:
  - tabelas `saude_perfil`, `saude_documentos`, `saude_anexos`, `saude_remedios`, `saude_doencas`, `saude_cirurgias`, `saude_notas`;
  - RLS: só os e-mails da função `saude_dono()` (Fausto e mais dois, ver a migration);
  - schema versionado em `supabase/migrations/20261024000000_schema_saude.sql` (extraído do banco em 24/10/2026 — mudou o banco, atualize o arquivo);
  - buckets privados `saude-miniaturas` (miniatura da lista) e `saude-inbox` (original até ir para o Drive);
  - Edge Function `saude-documento` (ler com o Claude, mandar ao Drive, reenviar pendentes).
    Publicar: `python3 ~/mnt/evoque/.ferramentas/saude_funcoes.py`.
- Leitura das fotos/PDFs: API do Claude (`ANTHROPIC_API_KEY`, modelo `claude-sonnet-5-5`).
- Originais: Google Drive do Fausto, pasta "Saúde Repositório/<Receitas | Pedidos de exame | Exames>".
- Login: Google (Supabase Auth do gerenciador-casa).
- Não mexer em nada do gerenciador-casa que não comece com `saude`.
