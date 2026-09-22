-- Materials Tracking schema
-- Matches the Materials Tracking Supabase project (RLS on all tables).

create extension if not exists "pgcrypto";

do $$ begin
  create type public.doc_type as enum ('packing_list', 'mtr', 'other');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_code text,
  product_name text not null,
  description text,
  size text,
  material_grade text,
  manufacturer text,
  unit text default 'ea',
  requires_serial boolean not null default false,
  heat_number_required boolean not null default true,
  import_batch_id uuid references public.import_batches (id) on delete set null,
  source_row jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  material_id uuid references public.materials (id) on delete set null,
  product_name text not null,
  product_code text,
  heat_number text not null,
  serial_number text,
  quantity numeric not null default 1,
  received_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  check_in_id uuid not null references public.check_ins (id) on delete cascade,
  doc_type public.doc_type not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists materials_user_id_idx on public.materials (user_id);
create index if not exists materials_product_name_idx on public.materials (user_id, product_name);
create index if not exists check_ins_user_id_idx on public.check_ins (user_id);
create index if not exists check_ins_heat_idx on public.check_ins (user_id, heat_number);
create index if not exists check_ins_serial_idx on public.check_ins (user_id, serial_number);
create index if not exists documents_check_in_id_idx on public.documents (check_in_id);

alter table public.import_batches enable row level security;
alter table public.materials enable row level security;
alter table public.check_ins enable row level security;
alter table public.documents enable row level security;

-- import_batches policies
drop policy if exists import_batches_select_own on public.import_batches;
create policy import_batches_select_own on public.import_batches
  for select using (auth.uid() = user_id);

drop policy if exists import_batches_insert_own on public.import_batches;
create policy import_batches_insert_own on public.import_batches
  for insert with check (auth.uid() = user_id);

drop policy if exists import_batches_delete_own on public.import_batches;
create policy import_batches_delete_own on public.import_batches
  for delete using (auth.uid() = user_id);

-- materials policies
drop policy if exists materials_select_own on public.materials;
create policy materials_select_own on public.materials
  for select using (auth.uid() = user_id);

drop policy if exists materials_insert_own on public.materials;
create policy materials_insert_own on public.materials
  for insert with check (auth.uid() = user_id);

drop policy if exists materials_update_own on public.materials;
create policy materials_update_own on public.materials
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists materials_delete_own on public.materials;
create policy materials_delete_own on public.materials
  for delete using (auth.uid() = user_id);

-- check_ins policies
drop policy if exists check_ins_select_own on public.check_ins;
create policy check_ins_select_own on public.check_ins
  for select using (auth.uid() = user_id);

drop policy if exists check_ins_insert_own on public.check_ins;
create policy check_ins_insert_own on public.check_ins
  for insert with check (auth.uid() = user_id);

drop policy if exists check_ins_update_own on public.check_ins;
create policy check_ins_update_own on public.check_ins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists check_ins_delete_own on public.check_ins;
create policy check_ins_delete_own on public.check_ins
  for delete using (auth.uid() = user_id);

-- documents policies
drop policy if exists documents_select_own on public.documents;
create policy documents_select_own on public.documents
  for select using (auth.uid() = user_id);

drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own on public.documents
  for insert with check (auth.uid() = user_id);

drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own on public.documents
  for delete using (auth.uid() = user_id);

-- Private storage bucket for packing lists / MTRs
insert into storage.buckets (id, name, public)
values ('material-documents', 'material-documents', false)
on conflict (id) do nothing;

drop policy if exists material_documents_select_own on storage.objects;
create policy material_documents_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'material-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists material_documents_insert_own on storage.objects;
create policy material_documents_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'material-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists material_documents_update_own on storage.objects;
create policy material_documents_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'material-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'material-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

drop policy if exists material_documents_delete_own on storage.objects;
create policy material_documents_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'material-documents'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
