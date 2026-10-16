import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const METERS_PER_MILE = 1609.344;

export async function PATCH(
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

    const body = await request.json();

    // Ownership check: the component must belong to this athlete
    const { data: comp, error: findErr } = await supabase
      .from('bike_components')
      .select('*')
      .eq('id', id)
      .eq('user_id', Number(athleteId))
      .single();

    if (findErr || !comp) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const update: Record<string, any> = {};

    // Brake type (rim/disc)
    if (body.variant !== undefined) {
      if (comp.component_type !== 'brake_pads' || !['rim', 'disc'].includes(body.variant)) {
        return NextResponse.json({ error: 'Invalid variant' }, { status: 400 });
      }
      update.variant = body.variant;

      if (!comp.thresholds_customized) {
        const { data: def } = await supabase
          .from('component_defaults')
          .select('*')
          .eq('component_type', `brake_pads:${body.variant}`)
          .single();
        if (def) {
          update.max_distance_meters = def.first_check_meters;
          update.repeat_every_meters = def.repeat_every_meters;
        }
      }
    }

    // Custom thresholds (values arrive in the user's units)
    if (body.first_check !== undefined || body.repeat_every !== undefined) {
      const perUnit = body.units === 'km' ? 1000 : METERS_PER_MILE;

      if (body.first_check !== undefined) {
        const v = Number(body.first_check);
        if (!Number.isFinite(v) || v <= 0) {
          return NextResponse.json({ error: 'First check must be a positive number' }, { status: 400 });
        }
        update.max_distance_meters = v * perUnit;
      }

      if (body.repeat_every !== undefined) {
        if (body.repeat_every === null || body.repeat_every === '' || Number(body.repeat_every) === 0) {
          update.repeat_every_meters = null;
        } else {
          const r = Number(body.repeat_every);
          if (!Number.isFinite(r) || r < 0) {
            return NextResponse.json({ error: 'Repeat interval must be a positive number' }, { status: 400 });
          }
          update.repeat_every_meters = r * perUnit;
        }
      }
      update.thresholds_customized = true;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bike_components')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Component update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Component PATCH error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}