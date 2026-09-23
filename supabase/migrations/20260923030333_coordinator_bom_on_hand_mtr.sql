-- Coordinator workflow: BOM line fields, job numbers, packing-list status,
-- and issue history. On-hand quantity is not stored:
--   received  = sum(check_ins.quantity) for the material
--   on hand   = received - issued_qty
--   remaining = ordered_qty - issued_qty when ordered_qty > 0, else on hand

alter table public.materials
  add column if not exists ordered_qty numeric not null default 0,
  add column if not exists issued_qty numeric not null default 0,
  add column if not exists project_number text,
  add column if not exists construction_order text,
  add column if not exists size_inches text,
  add column if not exists wall_sdr text,
  add column if not exists steel_grade text,
  add column if not exists model_number text,
  add column if not exists ansi_rating text,
  add column if not exists heat_lot_serial text,
  add column if not exists packing_list_status text default 'pending';

update public.materials
set
  size_inches = coalesce(size_inches, size),
  steel_grade = coalesce(steel_grade, material_grade),
  packing_list_status = coalesce(packing_list_status, 'pending')
where size_inches is null
   or steel_grade is null
   or packing_list_status is null;

alter table public.materials drop constraint if exists materials_ordered_qty_check;
alter table public.materials
  add constraint materials_ordered_qty_check check (ordered_qty >= 0);

alter table public.materials drop constraint if exists materials_issued_qty_check;
alter table public.materials
  add constraint materials_issued_qty_check check (issued_qty >= 0);

alter table public.materials drop constraint if exists materials_packing_list_status_check;
alter table public.materials
  add constraint materials_packing_list_status_check
  check (
    packing_list_status is null
    or packing_list_status in ('pending', 'full', 'partial', 'missing')
  );

alter table public.check_ins
  add column if not exists lot_number text;

create index if not exists materials_user_project_idx
  on public.materials (user_id, project_number, construction_order);

create index if not exists check_ins_material_id_idx
  on public.check_ins (material_id);

create table if not exists public.material_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  notes text,
  project_number text,
  construction_order text,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists material_issues_user_id_idx on public.material_issues (user_id);
create index if not exists material_issues_material_id_idx on public.material_issues (material_id);

alter table public.material_issues enable row level security;

drop policy if exists material_issues_select_own on public.material_issues;
create policy material_issues_select_own on public.material_issues
  for select using (auth.uid() = user_id);

drop policy if exists material_issues_insert_own on public.material_issues;
create policy material_issues_insert_own on public.material_issues
  for insert with check (auth.uid() = user_id);

drop policy if exists material_issues_update_own on public.material_issues;
create policy material_issues_update_own on public.material_issues
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists material_issues_delete_own on public.material_issues;
create policy material_issues_delete_own on public.material_issues
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on table public.material_issues to authenticated;
