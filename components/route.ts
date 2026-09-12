// app/api/components/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const athleteId = cookieStore.get('strava_session')?.value;

    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { strava_bike_id, name, component_type } = await request.json();

    const { data, error } = await supabase
      .from('bike_components')
      .insert([
        {
          user_id: athleteId,
          strava_bike_id,
          name,
          component_type,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}