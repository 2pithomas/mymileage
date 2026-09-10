// app/api/auth/strava/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.mymileage.cc';
  const redirectUri = `${appUrl}/api/auth/strava/callback`;

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${process.env.STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=read,activity:read_all,activity:write`;

  return NextResponse.redirect(stravaAuthUrl);
}