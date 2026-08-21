create index if not exists uniplug_replacement_approvals_client_idx
  on public.uniplug_replacement_approvals(client_id, created_at desc);

create index if not exists uniplug_replacement_approvals_reviewer_idx
  on public.uniplug_replacement_approvals(reviewed_by)
  where reviewed_by is not null;
