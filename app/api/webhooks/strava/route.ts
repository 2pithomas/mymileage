// app/api/webhooks/strava/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. Webhook Validation Handshake (GET Request from Strava)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.STRAVA_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge }, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// 2. Event Listener & Background Gear Sync (POST Request from Strava)
export async function POST(request: Request) {
  try {
    const event = await request.json();

    // Check if this is a newly created activity event
    if (event.object_type === 'activity' && event.aspect_type === 'create') {
      const athleteId = event.owner_id;

      // Run background gear update asynchronously without blocking the response to Strava
      syncAthleteGear(athleteId).catch((err) =>
        console.error(`Failed to sync gear for athlete ${athleteId}:`, err)
      );
    }

    // Always respond with 200 OK immediately so Strava knows the webhook was received
    return NextResponse.json({ message: 'Event processed' }, { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper: Fetch latest user token, refresh if needed, and update gear in Supabase
async function syncAthleteGear(athleteId: number) {
  // Fetch user session tokens from Supabase
  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('strava_athlete_id', athleteId)
    .single();

  if (userErr || !user) {
    console.error('User not found for athlete ID:', athleteId);
    return;
  }

  let accessToken = user.access_token;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSec = user.token_expires_at
    ? Math.floor(new Date(user.token_expires_at).getTime() / 1000)
    : 0;

  // Refresh access token if expired (or expiring in < 5 minutes)
  if (expiresAtSec <= nowInSeconds + 300) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: user.refresh_token,
      }),
    });

    const refreshed = await refreshRes.json();

    if (refreshed.access_token) {
      accessToken = refreshed.access_token;

      const { error: updErr } = await supabaseAdmin
        .from('users')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('strava_athlete_id', athleteId);

      if (updErr) console.error('Webhook token update error:', updErr);
    } else {
      console.error('Webhook token refresh failed:', refreshRes.status, refreshed);
    }
  }

  // Fetch updated athlete profile containing current bikes & shoes from Strava API
  const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!athleteRes.ok) {
    console.error('Failed to fetch athlete profile from Strava');
    return;
  }

  const athleteData = await athleteRes.json();
  const bikes = athleteData.bikes || [];

  // Upsert all bikes into your Supabase database
  for (const bike of bikes) {
    const { error } = await supabaseAdmin.from('bikes').upsert(
      {
        id: bike.id,
        user_id: athleteId.toString(),
        name: bike.name,
        primary_gear: bike.primary,
        ...(typeof bike.distance === 'number' ? { distance_meters: bike.distance } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) console.error('Webhook bike upsert error:', bike.id, error);
  }

  console.log(`Successfully synced ${bikes.length} bikes for athlete ${athleteId}`);
}