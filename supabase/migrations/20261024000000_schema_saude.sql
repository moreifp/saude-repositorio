-- Schema do Saúde Repositório, extraído do Supabase do gerenciador-casa em 24/10/2026.
-- Serve como registro versionado e para recriar o módulo num projeto novo.
-- Tudo aqui começa com "saude" — nada do gerenciador-casa é tocado.

-- ---------- funções ----------
create or replace function public.saude_dono()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce(lower(auth.jwt() ->> 'email') in ('fausto.moreira@gmail.com', 'guimaga@gmail.com', 'guimaga@icloud.com'), false)
$$;

create or replace function public.saude_touch()
returns trigger
language plpgsql
as $$
begin new.updated_at = now(); return new; end
$$;

-- ---------- tabelas ----------
create table if not exists public.saude_perfil (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null default '',
  nascimento  date,
  sangue      text not null default '',
  alergias    text not null default '',
  updated_at  timestamptz not null default now()
);

create table if not exists public.saude_documentos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria      text not null default 'receita' check (categoria in ('receita','pedido','exame')),
  medico         text not null default '',
  crm            text not null default '',
  data           date,
  exame_nome     text not null default '',
  local          text not null default '',
  exame_tipo     text not null default 'lab' check (exame_tipo in ('lab','img')),
  remedios       jsonb not null default '[]'::jsonb,
  pedidos        jsonb not null default '[]'::jsonb,
  arquivo_tipo   text not null default 'img' check (arquivo_tipo in ('img','pdf')),
  arquivo_mime   text not null default '',
  miniatura_path text,
  original_path  text,
  leitura_path   text,
  drive_file_id  text,
  drive_link     text,
  leitura        text not null default 'lendo' check (leitura in ('lendo','pronto','erro')),
  confirmado     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  especialidade  text not null default ''
);
create index if not exists saude_documentos_user_id_created_at_idx on public.saude_documentos (user_id, created_at desc);
create trigger saude_documentos_touch before update on public.saude_documentos
  for each row execute function public.saude_touch();

create table if not exists public.saude_anexos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid(),
  documento_id   uuid not null references public.saude_documentos(id) on delete cascade,
  tipo           text not null check (tipo in ('nf','pagamento')),
  arquivo_mime   text not null default '',
  miniatura_path text,
  original_path  text,
  drive_file_id  text,
  drive_link     text,
  created_at     timestamptz not null default now(),
  valor          numeric,
  data           date,
  emissor        text not null default '',
  leitura_path   text,
  leitura        text not null default 'lendo',
  unique (documento_id, tipo)
);
create index if not exists saude_anexos_doc on public.saude_anexos (documento_id);

create table if not exists public.saude_remedios (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome                text not null,
  dose                text not null default '',
  horario             text not null default '',
  ativo               boolean not null default true,
  inicio              date default current_date,
  parou_em            date,
  documento_id        uuid references public.saude_documentos(id) on delete set null,
  created_at          timestamptz not null default now(),
  foto_miniatura_path text,
  foto_original_path  text,
  foto_drive_id       text,
  foto_drive_link     text
);

create table if not exists public.saude_doencas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  desde      text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.saude_cirurgias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  ano        text not null default '',
  hospital   text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.saude_notas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid(),
  farmacia       text not null default '',
  cnpj           text not null default '',
  data           date,
  valor_total    numeric,
  itens          jsonb not null default '[]'::jsonb,
  arquivo_tipo   text not null default 'img',
  arquivo_mime   text not null default '',
  miniatura_path text,
  original_path  text,
  leitura_path   text,
  drive_file_id  text,
  drive_link     text,
  leitura        text not null default 'lendo',
  created_at     timestamptz not null default now()
);

-- ---------- RLS: só o dono (saude_dono) lê e mexe nos próprios registros ----------
do $$
declare t text;
begin
  foreach t in array array['saude_perfil','saude_documentos','saude_anexos','saude_remedios','saude_doencas','saude_cirurgias','saude_notas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono le" on public.%I', t);
    execute format('drop policy if exists "dono cria" on public.%I', t);
    execute format('drop policy if exists "dono altera" on public.%I', t);
    execute format('drop policy if exists "dono apaga" on public.%I', t);
    execute format('create policy "dono le"     on public.%I for select to authenticated using (user_id = auth.uid() and public.saude_dono())', t);
    execute format('create policy "dono cria"   on public.%I for insert to authenticated with check (user_id = auth.uid() and public.saude_dono())', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using (user_id = auth.uid() and public.saude_dono()) with check (user_id = auth.uid() and public.saude_dono())', t);
    execute format('create policy "dono apaga"  on public.%I for delete to authenticated using (user_id = auth.uid() and public.saude_dono())', t);
  end loop;
end $$;

-- ---------- storage: buckets privados, pasta por usuário ----------
insert into storage.buckets (id, name, public) values
  ('saude-miniaturas', 'saude-miniaturas', false),
  ('saude-inbox', 'saude-inbox', false)
on conflict (id) do nothing;

drop policy if exists "saude dono le"    on storage.objects;
drop policy if exists "saude dono envia" on storage.objects;
drop policy if exists "saude dono apaga" on storage.objects;
create policy "saude dono le" on storage.objects for select to authenticated
  using (bucket_id in ('saude-miniaturas','saude-inbox') and (storage.foldername(name))[1] = auth.uid()::text and public.saude_dono());
create policy "saude dono envia" on storage.objects for insert to authenticated
  with check (bucket_id in ('saude-miniaturas','saude-inbox') and (storage.foldername(name))[1] = auth.uid()::text and public.saude_dono());
create policy "saude dono apaga" on storage.objects for delete to authenticated
  using (bucket_id in ('saude-miniaturas','saude-inbox') and (storage.foldername(name))[1] = auth.uid()::text and public.saude_dono());
