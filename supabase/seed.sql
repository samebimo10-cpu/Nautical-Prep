-- Dev seed data. Content items are loaded by `pnpm content:import` (see scripts/import-content.ts).
insert into public.regulation_updates (title, body, item_ids)
values ('Welcome', 'Regulation updates will appear here. Linked questions are flagged for revision.', '{}')
on conflict do nothing;
