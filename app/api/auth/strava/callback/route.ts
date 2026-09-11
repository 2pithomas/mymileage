import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create an admin Supabase client using the Service Role Key to bypass RLS in server routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  // Exchange auth code for access & refresh tokens
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();

  if (data.errors) {
    return NextResponse.json({ error: 'Failed token exchange', details: data }, { status: 400 });
  }

  const { athlete, access_token, refresh_token, expires_at } = data;

  // Save or update user credentials in Supabase using the admin client
  const { error } = await supabaseAdmin.from('users').upsert({
    strava_athlete_id: athlete.id,
    access_token,
    refresh_token,
    token_expires_at: new Date(expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'strava_athlete_id' });

  if (error) {
    console.error('Supabase save error:', error);
    return NextResponse.json({ error: 'Failed to save user session', details: error.message }, { status: 500 });
  }

  // Redirect user to the dashboard
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`);
}