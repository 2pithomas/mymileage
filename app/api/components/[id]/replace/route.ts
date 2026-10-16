import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const METERS_PER_MILE = 1609.344;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const athleteId = cookieStore.get('strava_session')?.value;
    if (!athleteId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const perUnit = body.units === 'km' ? 1000 : METERS_PER_MILE;

    const { data: comp } = await supabase
      .from('bike_components')
      .select('*')
      .eq('id', id)
      .eq('user_id', Number(athleteId))
      .single();

    if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (comp.is_retired) return NextResponse.json({ error: 'Already replaced' }, { status: 409 });

    const { data: bike } = await supabase
      .from('bikes')
      .select('distance_meters, virtual_meters')
      .eq('id', comp.strava_bike_id)
      .eq('user_id', athleteId)
      .single();

    if (!bike) return NextResponse.json({ error: 'Bike not found' }, { status: 404 });

    const newName = typeof body.new_name === 'string' ? body.new_name.trim().slice(0, 120) : '';

    // Optional, typed by the user: how far the old part lasted
    let reported: number | null = null;
    if (body.reported_lifespan !== undefined && body.reported_lifespan !== null && body.reported_lifespan !== '') {
      const v = Number(body.reported_lifespan);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: 'Lifespan must be a positive number' }, { status: 400 });
      }
      reported = v * perUnit;
    }

    const now = new Date().toISOString();

    // Retire the old one; the is_retired=false filter makes a double-click harmless
    const { data: retired, error: retireErr } = await supabase
      .from('bike_components')
      .update({ is_retired: true, retired_at: now, reported_lifespan_meters: reported })
      .eq('id', id)
      .eq('is_retired', false)
      .select();

    if (retireErr) {
      console.error('Retire error:', retireErr);
      return NextResponse.json({ error: retireErr.message }, { status: 500 });
    }
    if (!retired || retired.length === 0) {
      return NextResponse.json({ error: 'Already replaced' }, { status: 409 });
    }

    const { data: created, error: insErr } = await supabase
      .from('bike_components')
      .insert({
        user_id: comp.user_id,
        strava_bike_id: comp.strava_bike_id,
        name: newName || comp.name,
        component_type: comp.component_type,
        variant: comp.variant,
        accumulated_distance_meters: 0,
        max_distance_meters: comp.max_distance_meters,
        repeat_every_meters: comp.repeat_every_meters,
        wear_multiplier: comp.wear_multiplier,
        counts_virtual: comp.counts_virtual,
        thresholds_customized: comp.thresholds_customized,
        starting_wear_meters: 0,
        installed_bike_meters: bike.distance_meters || 0,
        installed_bike_virtual_meters: bike.virtual_meters || 0,
        baseline_confirmed: true,
        installed_at: now,
        is_retired: false,
      })
      .select()
      .single();

    if (insErr) {
      console.error('Replacement insert error:', insErr);
      // Roll back so the user isn't left without the component
      await supabase
        .from('bike_components')
        .update({ is_retired: false, retired_at: null, reported_lifespan_meters: null })
        .eq('id', id);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: created });
  } catch (err) {
    console.error('Replace error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}