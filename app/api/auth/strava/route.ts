// app/api/auth/strava/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.mymileage.cc'}/api/auth/strava/callback`
  );

  // IMPORTANT: scope MUST contain activity:read_all to unlock athlete gear (bikes & shoes)
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=read,activity:read_all`;

  return NextResponse.redirect(stravaAuthUrl);
}