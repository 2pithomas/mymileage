// app/api/gear/route.ts
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

    const { name, category, brand_model } = await request.json();

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and Category are required' }, { status: 400 });
    }

    // Insert directly into custom_gear table
    const { data, error } = await supabase
      .from('custom_gear')
      .insert([
        {
          user_id: athleteId,
          name,
          category, // 'skis', 'snowboard', or 'shoes'
          brand_model: brand_model || '',
        },
      ])
      .select();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
