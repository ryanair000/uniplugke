import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secureEqual(a: string, b: string) {
  if (!a || !b) return false;
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function authorized(request: NextRequest) {
  const expected = process.env.OPS_HUB_SECRET?.trim() || '';
  const submitted = request.headers.get('x-ops-secret')?.trim() || '';
  return secureEqual(expected, submitted);
}

function client(admin: ReturnType<typeof createAdminSupabaseClient>) {
  if (!admin) throw new Error('Supabase admin client is not configured.');
  return admin;
}

async function loadProfiles(admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>) {
  const { data, error } = await admin
    .from('uniplug_profiles')
    .select('user_id,email,display_name,username,phone,role,status,created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

async function summary(admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>) {
  const profiles = await loadProfiles(admin);
  const activeProfiles = profiles.filter((row) => row.status === 'active');
  const pendingProfiles = profiles.filter((row) => row.status === 'pending');
  const suspendedProfiles = profiles.filter((row) => row.status === 'suspended');

  const userIds = profiles.map((row) => row.user_id).filter(Boolean);
  const { data: portalRows, error: portalError } = userIds.length
    ? await admin.from('client_portal_accounts').select('user_id,client_id').in('user_id', userIds)
    : { data: [], error: null };
  if (portalError) throw portalError;

  const clientIds = [...new Set((portalRows || []).map((row) => row.client_id).filter(Boolean))];
  const { data: subscriptions, error: subscriptionError } = clientIds.length
    ? await admin
        .from('client_subscriptions')
        .select('id,client_id,status,metadata,created_at,service:client_services!client_subscriptions_service_id_fkey(name)')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false })
        .limit(1500)
    : { data: [], error: null };
  if (subscriptionError) throw subscriptionError;

  const visibleSubscriptions = (subscriptions || []).filter((row) => {
    const metadata = (row.metadata || {}) as Record<string, unknown>;
    return metadata.portal_hidden !== true;
  });
  const statusCounts = visibleSubscriptions.reduce<Record<string, number>>((counts, row) => {
    const key = String(row.status || 'unknown');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  return {
    source: 'uniplug',
    generatedAt: new Date().toISOString(),
    members: {
      total: profiles.length,
      active: activeProfiles.length,
      pending: pendingProfiles.length,
      suspended: suspendedProfiles.length,
      linkedToLokimax: (portalRows || []).length,
      latest: profiles.slice(0, 12).map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        username: row.username,
        phone: row.phone,
        status: row.status,
        createdAt: row.created_at,
      })),
    },
    subscriptions: {
      total: visibleSubscriptions.length,
      statusCounts,
    },
  };
}

async function searchMember(admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>, rawQuery: string) {
  const query = rawQuery.trim().replace(/^@/, '');
  if (!query) return [];
  const safe = query.replace(/[%_\\]/g, '\\$&');
  const { data: profiles, error } = await admin
    .from('uniplug_profiles')
    .select('user_id,email,display_name,username,phone,role,status,created_at')
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`)
    .limit(20);
  if (error) throw error;
  if (!profiles?.length) return [];

  const userIds = profiles.map((row) => row.user_id);
  const { data: portalRows, error: portalError } = await admin
    .from('client_portal_accounts')
    .select('user_id,client_id')
    .in('user_id', userIds);
  if (portalError) throw portalError;
  const clientIdByUser = new Map((portalRows || []).map((row) => [row.user_id, row.client_id] as const));
  const clientIds = [...new Set((portalRows || []).map((row) => row.client_id).filter(Boolean))];

  const { data: subscriptions, error: subscriptionError } = clientIds.length
    ? await admin
        .from('client_subscriptions')
        .select('id,client_id,status,metadata,service:client_services!client_subscriptions_service_id_fkey(name)')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false })
        .limit(250)
    : { data: [], error: null };
  if (subscriptionError) throw subscriptionError;

  return profiles.map((profile) => {
    const clientId = clientIdByUser.get(profile.user_id);
    const memberSubscriptions = (subscriptions || [])
      .filter((row) => row.client_id === clientId && ((row.metadata || {}) as Record<string, unknown>).portal_hidden !== true)
      .map((row) => {
        const service = Array.isArray(row.service) ? row.service[0] : row.service;
        return {
          id: row.id,
          serviceName: (service as { name?: string } | null)?.name || 'Digital service',
          status: row.status,
        };
      });
    return {
      userId: profile.user_id,
      displayName: profile.display_name,
      username: profile.username,
      phone: profile.phone,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      linkedClientId: clientId || null,
      subscriptions: memberSubscriptions,
    };
  });
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = client(createAdminSupabaseClient());
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const url = new URL(request.url);
  const action = String(body.action || url.searchParams.get('action') || 'summary').trim().toLowerCase();

  try {
    if (action === 'summary') {
      return NextResponse.json({ ok: true, data: await summary(admin) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'search-member') {
      const query = String(body.query || url.searchParams.get('q') || '');
      return NextResponse.json({ ok: true, data: await searchMember(admin, query) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: 'Unknown action', available: ['summary', 'search-member'] }, { status: 400 });
  } catch (error) {
    console.error('[telegram-ops] UniPlug adapter failed:', error);
    return NextResponse.json({ error: 'Ops adapter failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
