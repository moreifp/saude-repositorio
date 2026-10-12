# Saúde Repositório — regras para trabalhar neste repositório

- Português do Brasil em tudo (código, telas, commits, explicações).
- Feito só com o Claude. Nunca usar o Lovable.
- Telas: poucos cliques, pouco texto, ícones grandes, navegação óbvia. Não mudar o visual sem o Fausto pedir.
- Nunca gravar chave, senha ou token no código nem no git. As chaves ficam em `~/evoque/chaves.env.txt` (só no Mac).

## Onde roda
- Front: Cloudflare Workers, SPA estática de `dist/`, em https://saude.evoque.global.
  Publicar: `python3 ~/mnt/evoque/.ferramentas/saude_publicar.py` (build + deploy).
- Back: Supabase do **gerenciador-casa** (ref `zbntjvgbghftpkwcgasr`), separado por prefixo:
  - tabelas `saude_documentos`, `saude_remedios`, `saude_doencas`, `saude_cirurgias`, `saude_perfil`;
  - RLS: só `fausto.moreira@gmail.com` (função `saude_dono()`);
  - buckets privados `saude-miniaturas` (miniatura da lista) e `saude-inbox` (original até ir para o Drive);
  - Edge Function `saude-documento` (ler com o Claude, mandar ao Drive, reenviar pendentes).
    Publicar: `python3 ~/mnt/evoque/.ferramentas/saude_funcoes.py`.
- Leitura das fotos/PDFs: API do Claude (`ANTHROPIC_API_KEY`, modelo `claude-sonnet-5-5`).
- Originais: Google Drive do Fausto, pasta "Saúde Repositório/<Receitas | Pedidos de exame | Exames>".
- Login: Google (Supabase Auth do gerenciador-casa).
- Não mexer em nada do gerenciador-casa que não comece com `saude`.
