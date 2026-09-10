import { NextResponse } from 'next/server';

// 1. GET: Strava Subscription Handshake Verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.STRAVA_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Strava Webhook Verified Successfully!');
    return NextResponse.json({ 'hub.challenge': challenge }, { status: 200 });
  }

  return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
}

// 2. POST: Handle Incoming Activity Events
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { object_type, aspect_type, object_id, owner_id } = body;

    console.log(`Received Strava Event: ${aspect_type} on ${object_type} (ID: ${object_id}) for athlete ${owner_id}`);

    if (object_type === 'activity' && aspect_type === 'create') {
      // TODO: Async job queue trigger:
      // 1. Fetch activity details from Strava API
      // 2. Update gear/components wear in Supabase database
    }

    // Always return 200 OK within 2 seconds
    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}