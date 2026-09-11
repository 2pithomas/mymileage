// app/api/auth/strava/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // 1. Exchange auth code for Strava Access & Refresh Tokens
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

    if (!tokenRes.ok || !tokenData.athlete) {
      console.error('Strava Token Exchange Failed:', tokenData);
      return NextResponse.redirect(new URL('/', request.url));
    }

    const athleteId = tokenData.athlete.id.toString();

    // 2. Upsert (insert or update) user details & tokens in Supabase
    const { error: dbError } = await supabase.from('users').upsert(
      {
        strava_athlete_id: athleteId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'strava_athlete_id' }
    );

    if (dbError) {
      console.error('Supabase user save error:', dbError);
    }

    // 3. Set the strava_session cookie in the user's browser
    const cookieStore = await cookies();
    cookieStore.set('strava_session', athleteId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // 4. Send the user to their Dashboard!
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.mymileage.cc';
    return NextResponse.redirect(`${appUrl}/dashboard`);

  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}