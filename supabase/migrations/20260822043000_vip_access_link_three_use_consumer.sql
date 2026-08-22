-- Superseded by 20260822043100_uniplug_member_access_links_48h_three_use.sql.
-- Keep this migration version as a harmless no-op so clean database rebuilds do
-- not depend on the separate legacy vip_access_links table.
do $$
begin
  null;
end;
$$;
