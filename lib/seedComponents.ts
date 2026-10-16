import type { SupabaseClient } from '@supabase/supabase-js';

const DISPLAY_NAMES: Record<string, string> = {
  chain: 'Chain',
  tire_front: 'Front tire',
  tire_rear: 'Rear tire',
  brake_pads: 'Brake pads',
  cassette: 'Cassette',
  chainring: 'Chainring',
};

const NO_DEFAULTS = /peloton/i;

// Seeds default components once per bike. Returns true if any bike was processed.
export async function seedDefaultComponents(
  supabase: SupabaseClient,
  athleteId: string,
  bikes: any[]
): Promise<boolean> {
  const unseeded = bikes.filter((b) => !b.components_seeded);
  if (unseeded.length === 0) return false;

  const { data: defaults, error: defErr } = await supabase
    .from('component_defaults')
    .select('*');
  if (defErr || !defaults?.length) {
    console.error('component_defaults read error:', defErr);
    return false;
  }

  for (const bike of unseeded) {
    const label = `${bike.name ?? ''} ${bike.brand_name ?? ''} ${bike.model_name ?? ''}`;
    const track = bike.track_components !== false && !NO_DEFAULTS.test(label);

    if (track) {
      const rows = defaults.map((d: any) => ({
        user_id: Number(athleteId),
        strava_bike_id: bike.id,
        name: DISPLAY_NAMES[d.component_type] ?? d.component_type,
        component_type: d.component_type,
        accumulated_distance_meters: 0,
        max_distance_meters: d.first_check_meters,
        repeat_every_meters: d.repeat_every_meters,
        wear_multiplier: d.wear_multiplier,
        counts_virtual: d.counts_virtual,
        starting_wear_meters: 0,
        installed_bike_meters: 0,
        installed_bike_virtual_meters: 0,
        baseline_confirmed: false,
        installed_at: new Date().toISOString(),
        is_retired: false,
      }));

      const { error } = await supabase.from('bike_components').insert(rows);
      // 23505 = unique violation: another request already seeded this bike
      if (error && error.code !== '23505') {
        console.error('Component seed error:', bike.id, error);
        continue;
      }
    }

    const { error: flagErr } = await supabase
      .from('bikes')
      .update({ components_seeded: true, track_components: track })
      .eq('id', bike.id);
    if (flagErr) console.error('Seed flag error:', bike.id, flagErr);
  }
  return true;
}