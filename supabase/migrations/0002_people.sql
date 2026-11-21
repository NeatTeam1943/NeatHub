-- =============================================================================
-- NEATHUB and NeatSystem's people. Run after 0001_neathub.sql. Re-runnable.
-- =============================================================================

-- NeatSystem: a profile a mentor made ahead of time was claimed by its person's
-- login (hub.claim_profile calls every <schema>.on_profile_claimed). Whatever was
-- set here for the old id (which totes they edit, what they created) follows.
create or replace function neathub.on_profile_claimed(p_old uuid, p_new uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into neathub.scopes (user_id, scope) select p_new, scope from neathub.scopes where user_id = p_old on conflict do nothing;
  delete from neathub.scopes where user_id = p_old;
  update neathub.nodes set created_by = p_new where created_by = p_old;
end $$;

revoke all on function neathub.on_profile_claimed(uuid, uuid) from public, anon, authenticated;
