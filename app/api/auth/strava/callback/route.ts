// app/api/auth/strava/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    // 1. Exchange OAuth code for Strava Access & Refresh Tokens
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }

    const athlete = tokenData.athlete;
    const athleteId = athlete.id.toString();

    // 2. Save/Update User Row in Supabase
    await supabaseAdmin.from('users').upsert({
      strava_athlete_id: athleteId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      profile_picture: athlete.profile,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'strava_athlete_id' });

    // 3. Fetch Full Athlete Profile to get all Bikes & Shoes
    const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (athleteRes.ok) {
      const fullProfile = await athleteRes.json();

      // Ingest Bikes
      if (fullProfile.bikes && fullProfile.bikes.length > 0) {
        const bikeRows = fullProfile.bikes.map((bike: any) => ({
          id: bike.id,
          user_id: athleteId,
          name: bike.name,
          primary_gear: bike.primary,
          distance: bike.converted_distance || bike.distance,
          updated_at: new Date().toISOString(),
        }));

        await supabaseAdmin.from('bikes').upsert(bikeRows, { onConflict: 'id' });
      }

      // Ingest Shoes
      if (fullProfile.shoes && fullProfile.shoes.length > 0) {
        const shoeRows = fullProfile.shoes.map((shoe: any) => ({
          id: shoe.id,
          user_id: athleteId,
          name: shoe.name,
          primary_gear: shoe.primary,
          distance: shoe.converted_distance || shoe.distance,
          updated_at: new Date().toISOString(),
        }));

        await supabaseAdmin.from('shoes').upsert(shoeRows, { onConflict: 'id' });
      }
    }

    // 4. Set Session Cookie & Redirect to Dashboard
    const cookieStore = await cookies();
    cookieStore.set('strava_session', athleteId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}