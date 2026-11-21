-- =============================================================================
-- NEATHUB — the team's links hub (kit totes and game pieces) — a NeatSystem
-- sub-system. Lives in NeatSystem's Supabase project:
--   neathub      tables. Private.
--   neathub_api  the contract: functions only.
-- People, login and positions are NeatSystem's (hub); this system never writes
-- hub and reads people only through hub.people / hub.has_perm / hub.is_active.
-- Same rules as the old firestore.rules. Run after NeatSystem's migrations.
-- Re-runnable.
--
-- Supabase dashboard: add `neathub_api` to Settings -> API -> Exposed schemas.
--
-- Who is what here (was users/{uid}.role in Firestore, now from NeatSystem):
--   mentor  hub permission neathub.manage   (default: mentors)
--   lead    hub permission neathub.lead     (default: team leads, captains) — edits
--           only the scopes a mentor gave them (a top-level tote, or 'root' = home page)
--   member  any active NeatSystem member
--   guest   anyone else (sees only "public" items)
-- =============================================================================

create schema if not exists neathub;
create schema if not exists neathub_api;
revoke all on schema neathub from public, anon, authenticated;
grant usage on schema neathub_api to anon, authenticated;

create table if not exists neathub.nodes (
  id             text primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  parent_id      text references neathub.nodes (id) on delete cascade,
  type           text not null check (type in ('hub', 'link')),
  title          text not null check (char_length(title) between 1 and 60),
  label_mode     text not null default 'txt' check (label_mode in ('txt', 'img', 'both')),
  label_text     text check (label_text is null or char_length(label_text) <= 60),
  image_data     text check (image_data is null or char_length(image_data) < 300000),
  image_url      text check (image_url is null or image_url ~ '^https?://'),
  image_fallback text check (image_fallback is null or image_fallback ~ '^https?://'),
  season         int,
  slug           text check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  piece          text,
  visibility     text not null check (visibility in ('public', 'members', 'leads', 'mentors')),
  eff_vis        text not null check (eff_vis in ('public', 'members', 'leads', 'mentors')),
  scope          text not null,
  sort           double precision not null default 0,
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  constraint hub_has_season check (type = 'link' or season is not null)
);
create index if not exists nodes_parent_idx on neathub.nodes (parent_id);
create unique index if not exists nodes_slug_idx on neathub.nodes (coalesce(parent_id, ''), slug) where slug is not null;

-- the URL is separate so a locked link's address never reaches someone who may not open it
create table if not exists neathub.urls (
  id  text primary key references neathub.nodes (id) on delete cascade,
  url text not null check (url ~ '^https?://.+' and char_length(url) < 2000)
);
-- which top-level totes (or 'root' = the home page) a lead may edit
create table if not exists neathub.scopes (
  user_id uuid not null,
  scope   text not null,
  primary key (user_id, scope)
);
alter table neathub.nodes enable row level security;
alter table neathub.urls enable row level security;
alter table neathub.scopes enable row level security;

select hub.register_permissions('neathub', '[
  {"key": "neathub.lead",   "label": "עריכת ארגזים ב-NEATHUB (מה שמנטור סימן)", "grp": "NEATHUB", "sort": 1, "roles": ["team_lead", "captain"]},
  {"key": "neathub.manage", "label": "ניהול NEATHUB: הכל, כולל מי עורך מה", "grp": "NEATHUB", "sort": 2, "roles": ["mentor", "admin"]}
]'::jsonb);
select hub.register_subsystem('neathub', 'NEATHUB', 'neathub_api', 'profile_v1', 30);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function neathub.role(p_uid uuid default auth.uid()) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_uid is null or not hub.is_active(p_uid) then 'guest'
    when hub.has_perm('neathub.manage', p_uid) then 'mentor'
    when hub.has_perm('neathub.lead', p_uid) then 'lead'
    else 'member' end
$$;
create or replace function neathub.vis_rank(v text) returns int language sql immutable as $$
  select case v when 'public' then 0 when 'members' then 1 when 'leads' then 2 when 'mentors' then 3 end $$;
create or replace function neathub.role_rank(r text) returns int language sql immutable as $$
  select case r when 'member' then 1 when 'lead' then 2 when 'mentor' then 3 else 0 end $$;
create or replace function neathub.can_view(p_vis text, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select neathub.vis_rank(p_vis) <= neathub.role_rank(neathub.role(p_uid)) $$;
create or replace function neathub.has_scope(p_scope text, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from neathub.scopes s where s.user_id = p_uid and s.scope = p_scope) $$;
-- same as canEditNode() in src/lib/model.js
create or replace function neathub.can_edit(p_scope text, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select neathub.role(p_uid) = 'mentor' or (neathub.role(p_uid) = 'lead' and neathub.has_scope(p_scope, p_uid)) $$;

-- -----------------------------------------------------------------------------
-- neathub_api: reads
-- -----------------------------------------------------------------------------
-- All nodes (titles, labels, seasons) — public, like before. No URLs here.
create or replace function neathub_api.nodes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'parentId', n.parent_id, 'type', n.type, 'title', n.title, 'labelMode', n.label_mode, 'labelText', n.label_text,
    'imageData', n.image_data, 'imageUrl', n.image_url, 'imageFallback', n.image_fallback, 'season', n.season, 'slug', n.slug,
    'piece', n.piece, 'visibility', n.visibility, 'effVis', n.eff_vis, 'scope', n.scope, 'order', n.sort, 'createdBy', n.created_by
  ) order by n.sort), '[]'::jsonb) from neathub.nodes n
$$;

-- The signed-in person as NEATHUB sees them.
create or replace function neathub_api.me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('uid', auth.uid(), 'role', neathub.role(),
    'scopes', coalesce((select jsonb_agg(s.scope) from neathub.scopes s where s.user_id = auth.uid()), '[]'::jsonb))
$$;

-- A link's URL, only for who may open it (or edit it).
create or replace function neathub_api.url(p_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare n neathub.nodes;
begin
  select * into n from neathub.nodes where id = p_id;
  if n.id is null then return null; end if;
  if not (neathub.can_view(n.eff_vis) or neathub.can_edit(n.scope)) then
    raise exception 'permission-denied' using errcode = '42501';
  end if;
  return (select u.url from neathub.urls u where u.id = p_id);
end $$;

-- People + their role here + their scopes (mentors only; the admin page).
create or replace function neathub_api.users() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if neathub.role() <> 'mentor' then raise exception 'רק מנטורים' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'uid', p.id, 'name', p.full_name, 'email', p.email, 'photo', p.avatar_url, 'createdAt', p.created_at,
    'role', neathub.role(p.id),
    'scopes', coalesce((select jsonb_agg(s.scope) from neathub.scopes s where s.user_id = p.id), '[]'::jsonb)
  ) order by p.full_name), '[]'::jsonb) from hub.people p where p.status = 'active');
end $$;

-- What NeatSystem shows on a profile: which totes this person edits.
create or replace function neathub_api.profile_v1(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('contract', 1, 'title', 'NEATHUB', 'link', '/neathub', 'blocks',
    case when neathub.role(p_user) = 'mentor' then jsonb_build_array(jsonb_build_object('kind', 'text', 'text', 'עורך/ת את כל ה-NEATHUB'))
         when exists (select 1 from neathub.scopes s where s.user_id = p_user) then jsonb_build_array(jsonb_build_object('kind', 'chips', 'title', 'עורך/ת', 'items',
           (select jsonb_agg(jsonb_build_object('label', coalesce(n.title, case when s.scope = 'root' then 'דף הבית' else s.scope end), 'tone', 'brand'))
            from neathub.scopes s left join neathub.nodes n on n.id = s.scope where s.user_id = p_user)))
         else '[]'::jsonb end)
  where hub.is_active()
  union all select jsonb_build_object('contract', 1, 'blocks', '[]'::jsonb) where not hub.is_active()
$$;

-- -----------------------------------------------------------------------------
-- neathub_api: writes (same rules as the old firestore.rules)
-- -----------------------------------------------------------------------------
-- Save nodes (create or update) + the URLs that changed, in one transaction.
-- p_nodes: [{ id, parentId, type, title, labelMode, labelText, imageData, imageUrl, imageFallback,
--             season, slug, piece, visibility, effVis, scope, order }]
-- p_urls:  { "<id>": "https://..." }
-- p_grant_scope: a brand-new top-level tote a lead with the home-page permission
--                just created — it is added to their own scopes.
create or replace function neathub_api.save_nodes(p_nodes jsonb, p_urls jsonb default '{}'::jsonb, p_grant_scope text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v_role text := neathub.role();
  d jsonb;
  old neathub.nodes;
  par neathub.nodes;
  n neathub.nodes;
  v_new_top text[] := '{}';
begin
  if v_role not in ('mentor', 'lead') then raise exception 'אין הרשאה לערוך' using errcode = '42501'; end if;
  for d in select * from jsonb_array_elements(p_nodes) loop
    select * into old from neathub.nodes where id = d ->> 'id';
    if old.id is not null then
      if not neathub.can_edit(old.scope) then raise exception 'אין הרשאה לערוך את %', old.title using errcode = '42501'; end if;
    else
      -- new items: editable where they land, or a new top-level tote by a lead with the home page
      if not (neathub.can_edit(d ->> 'scope')
              or ((d ->> 'parentId') is null and d ->> 'type' = 'hub' and neathub.has_scope('root'))) then
        raise exception 'אין הרשאה להוסיף כאן' using errcode = '42501';
      end if;
      if (d ->> 'parentId') is null and d ->> 'type' = 'hub' then v_new_top := v_new_top || (d ->> 'id'); end if;
    end if;
    insert into neathub.nodes as t (id, parent_id, type, title, label_mode, label_text, image_data, image_url, image_fallback, season, slug, piece, visibility, eff_vis, scope, sort, created_by)
    values (d ->> 'id', d ->> 'parentId', d ->> 'type', d ->> 'title', coalesce(d ->> 'labelMode', 'txt'), d ->> 'labelText', d ->> 'imageData',
            d ->> 'imageUrl', d ->> 'imageFallback', (d ->> 'season')::int, nullif(d ->> 'slug', ''), d ->> 'piece', d ->> 'visibility', d ->> 'effVis',
            d ->> 'scope', coalesce((d ->> 'order')::double precision, 0), me)
    on conflict (id) do update set parent_id = excluded.parent_id, type = excluded.type, title = excluded.title, label_mode = excluded.label_mode,
      label_text = excluded.label_text, image_data = excluded.image_data, image_url = excluded.image_url, image_fallback = excluded.image_fallback,
      season = excluded.season, slug = excluded.slug, piece = excluded.piece, visibility = excluded.visibility, eff_vis = excluded.eff_vis,
      scope = excluded.scope, sort = excluded.sort, updated_at = now();
  end loop;

  if p_grant_scope is not null then
    if p_grant_scope <> all(v_new_top) or v_role <> 'lead' then raise exception 'אפשר לקבל רק ארגז חדש שיצרת עכשיו' using errcode = '42501'; end if;
    insert into neathub.scopes values (me, p_grant_scope) on conflict do nothing;
  end if;

  -- check every saved node against the final state: placement, derived fields, edit rights where it ended up
  for d in select * from jsonb_array_elements(p_nodes) loop
    select * into n from neathub.nodes where id = d ->> 'id';
    if n.parent_id is null then
      if n.scope <> (case when n.type = 'hub' then n.id else 'root' end) then raise exception 'מיקום לא תקין (%)', n.title using errcode = '22023'; end if;
      if n.eff_vis <> n.visibility then raise exception 'נראות לא תקינה (%)', n.title using errcode = '22023'; end if;
    else
      select * into par from neathub.nodes where id = n.parent_id;
      if par.id is null or par.type <> 'hub' then raise exception 'ההורה חייב להיות ארגז' using errcode = '22023'; end if;
      if n.scope <> par.scope then raise exception 'מיקום לא תקין (%)', n.title using errcode = '22023'; end if;
      if n.eff_vis <> (case when neathub.vis_rank(n.visibility) >= neathub.vis_rank(par.eff_vis) then n.visibility else par.eff_vis end) then
        raise exception 'נראות לא תקינה (%)', n.title using errcode = '22023';
      end if;
    end if;
    if not neathub.can_edit(n.scope) then raise exception 'אין הרשאה לערוך את %', n.title using errcode = '42501'; end if;
  end loop;

  -- URLs (links only)
  insert into neathub.urls (id, url)
  select k, v #>> '{}' from jsonb_each(coalesce(p_urls, '{}'::jsonb)) as e(k, v)
  where exists (select 1 from neathub.nodes x where x.id = k and x.type = 'link' and neathub.can_edit(x.scope))
  on conflict (id) do update set url = excluded.url;
  if exists (select 1 from jsonb_object_keys(coalesce(p_urls, '{}'::jsonb)) k
             where not exists (select 1 from neathub.nodes x where x.id = k and x.type = 'link' and neathub.can_edit(x.scope))) then
    raise exception 'אין הרשאה לשנות את הקישור' using errcode = '42501';
  end if;
end $$;

-- Delete nodes (and everything inside them). Removing from the home page also needs the home-page permission.
create or replace function neathub_api.delete_nodes(p_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare n neathub.nodes;
begin
  for n in select * from neathub.nodes where id = any(p_ids) loop
    if not neathub.can_edit(n.scope) then raise exception 'אין הרשאה למחוק את %', n.title using errcode = '42501'; end if;
    if n.parent_id is null and neathub.role() <> 'mentor' and not neathub.has_scope('root') then
      raise exception 'מחיקה מדף הבית דורשת הרשאה לדף הבית' using errcode = '42501';
    end if;
  end loop;
  delete from neathub.nodes where id = any(p_ids);
end $$;

-- A mentor sets which top-level totes (and/or 'root') someone may edit.
create or replace function neathub_api.set_scopes(p_user uuid, p_scopes text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if neathub.role() <> 'mentor' then raise exception 'רק מנטורים' using errcode = '42501'; end if;
  if exists (select 1 from unnest(p_scopes) s where s <> 'root' and not exists (select 1 from neathub.nodes n where n.id = s and n.parent_id is null and n.type = 'hub')) then
    raise exception 'אפשר לתת רק ארגז ראשי או את דף הבית' using errcode = '22023';
  end if;
  delete from neathub.scopes where user_id = p_user;
  insert into neathub.scopes select p_user, s from unnest(p_scopes) s on conflict do nothing;
end $$;

revoke all on all tables in schema neathub from public, anon, authenticated;
revoke all on all functions in schema neathub from public, anon, authenticated;
revoke all on all functions in schema neathub_api from public, anon;
grant execute on all functions in schema neathub_api to authenticated;
-- titles and the URLs of public links stay open to guests, as before
grant execute on function neathub_api.nodes(), neathub_api.url(text), neathub_api.me() to anon;
