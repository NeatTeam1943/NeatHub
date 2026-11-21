-- NEATHUB SQL tests. Run by NeatSystem's scripts/test-db.sh (needs hub + t.*).
\set ON_ERROR_STOP on
set client_min_messages = notice;
reset role;
create or replace function t.nid(p text) returns uuid language sql immutable as $$
  select ('20000000-0000-0000-0000-' || lpad(case p when 'mentor' then '1' when 'lead' then '2' when 'member' then '3' when 'gone' then '4' end, 12, '0'))::uuid $$;
grant execute on function t.nid(text) to public;
insert into auth.users (id, email) select t.nid(x), x || '@nh.test' from unnest(array['mentor','lead','member','gone']) x on conflict do nothing;
insert into hub.profiles (id, email, full_name, position, status, team) values
  (t.nid('mentor'), 'mentor@nh.test', 'מנטור האב', 'mentor', 'active', null),
  (t.nid('lead'), 'lead@nh.test', 'רש"צ האב', 'team_lead', 'active', 'software'),
  (t.nid('member'), 'member@nh.test', 'חבר האב', 'member', 'active', 'software'),
  (t.nid('gone'), 'gone@nh.test', 'עזב האב', 'member', 'archived', 'software')
on conflict (id) do nothing;

set role authenticated;
select t.login(t.nid('mentor'));
select neathub_api.save_nodes('[
  {"id":"sw","parentId":null,"type":"hub","title":"תוכנה","season":2024,"visibility":"public","effVis":"public","scope":"sw","order":1,"labelMode":"txt"},
  {"id":"sw_docs","parentId":"sw","type":"link","title":"תיעוד","visibility":"members","effVis":"members","scope":"sw","order":1,"labelMode":"txt"},
  {"id":"sw_sec","parentId":"sw","type":"hub","title":"סודי","season":2024,"visibility":"mentors","effVis":"mentors","scope":"sw","order":2,"labelMode":"txt"},
  {"id":"sw_sec_l","parentId":"sw_sec","type":"link","title":"מפתח","visibility":"public","effVis":"mentors","scope":"sw","order":1,"labelMode":"txt"},
  {"id":"home_l","parentId":null,"type":"link","title":"אתר","visibility":"public","effVis":"public","scope":"root","order":5,"labelMode":"txt"}
]', '{"sw_docs":"https://docs.example","sw_sec_l":"https://secret.example","home_l":"https://site.example"}');
select t.eq(jsonb_array_length(neathub_api.nodes()), 5, 'mentor saved a tree');

-- roles come from NeatSystem
select t.eq(neathub_api.me() ->> 'role', 'mentor', 'mentor role from hub position');
select t.login(t.nid('lead'));
select t.eq(neathub_api.me() ->> 'role', 'lead', 'team lead = lead');
select t.login(t.nid('member'));
select t.eq(neathub_api.me() ->> 'role', 'member', 'member');
select t.login(t.nid('gone'));
select t.eq(neathub_api.me() ->> 'role', 'guest', 'archived = guest');

-- URLs follow visibility
select t.login(null);
select t.eq(jsonb_array_length(neathub_api.nodes()), 5, 'guests see titles');
select t.eq(neathub_api.url('home_l'), 'https://site.example', 'guest opens a public link');
select t.eq(t.err($$select neathub_api.url('sw_docs')$$), '42501', 'guest cannot open a members link');
select t.login(t.nid('member'));
select t.eq(neathub_api.url('sw_docs'), 'https://docs.example', 'member opens a members link');
select t.eq(t.err($$select neathub_api.url('sw_sec_l')$$), '42501', 'locked by an ancestor tote');

-- leads edit only their scopes
select t.login(t.nid('lead'));
select t.eq(t.err($$select neathub_api.save_nodes('[{"id":"sw","parentId":null,"type":"hub","title":"X","season":2024,"visibility":"public","effVis":"public","scope":"sw","order":1}]')$$), '42501', 'lead without scope cannot edit');
select t.login(t.nid('mentor'));
select neathub_api.set_scopes(t.nid('lead'), array['sw']);
select t.eq(t.err($$select neathub_api.set_scopes(t.nid('lead'), array['sw_docs'])$$), '22023', 'only top-level totes can be scopes');
select t.login(t.nid('lead'));
select neathub_api.save_nodes('[{"id":"sw_new","parentId":"sw","type":"link","title":"חדש","visibility":"public","effVis":"public","scope":"sw","order":3}]', '{"sw_new":"https://new.example"}');
select t.eq(t.err($$select neathub_api.save_nodes('[{"id":"bad","parentId":"sw","type":"link","title":"x","visibility":"public","effVis":"public","scope":"other","order":3}]')$$), '42501', 'cannot claim a scope you do not have');
select t.eq(t.err($$select neathub_api.save_nodes('[{"id":"bad2","parentId":"sw_sec","type":"link","title":"x","visibility":"public","effVis":"public","scope":"sw","order":3}]')$$), '22023', 'effective visibility must follow the parent');
select t.eq(t.err($$select neathub_api.save_nodes('[{"id":"top","parentId":null,"type":"hub","title":"x","season":2024,"visibility":"public","effVis":"public","scope":"top","order":3}]', '{}', 'top')$$), '42501', 'no home-page permission, no new top tote');
select t.eq(t.err($$select neathub_api.delete_nodes(array['home_l'])$$), '42501', 'lead cannot delete from the home page');
select neathub_api.delete_nodes(array['sw_new']);
select t.eq(jsonb_array_length(neathub_api.nodes()), 5, 'lead deleted inside own tote');

-- home-page permission: a new top tote is granted automatically
select t.login(t.nid('mentor'));
select neathub_api.set_scopes(t.nid('lead'), array['sw', 'root']);
select t.login(t.nid('lead'));
select neathub_api.save_nodes('[{"id":"mine","parentId":null,"type":"hub","title":"שלי","season":2025,"visibility":"public","effVis":"public","scope":"mine","order":9}]', '{}', 'mine');
select t.eq((neathub_api.me() -> 'scopes') ? 'mine', true, 'new top tote granted to its creator');

-- members and the profile
select t.login(t.nid('member'));
select t.eq(t.err($$select neathub_api.save_nodes('[]')$$), '42501', 'members cannot edit');
select t.eq(t.err($$select neathub_api.users()$$), '42501', 'only mentors list users');
select t.eq((select b ->> 'kind' from jsonb_array_elements(neathub_api.profile_v1(t.nid('lead')) -> 'blocks') b), 'chips', 'profile lists a lead''s totes');
select t.eq(jsonb_array_length(neathub_api.profile_v1(t.nid('member')) -> 'blocks'), 0, 'nothing to show for a member');
select t.eq((select provolatile from pg_proc where oid = 'neathub_api.profile_v1(uuid)'::regprocedure)::text, 's', 'profile_v1 is STABLE');
select t.eq(t.err($$select * from neathub.nodes$$), '42501', 'tables are closed');

reset role;
\echo NEATHUB TESTS PASSED
