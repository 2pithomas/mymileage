export const METERS_PER_MILE = 1609.344;

export function wearMeters(
  bike: { distance_meters: number; virtual_meters: number },
  c: {
    counts_virtual: boolean;
    starting_wear_meters: number;
    installed_bike_meters: number;
    installed_bike_virtual_meters: number;
    wear_multiplier: number;
  }
) {
  const total = bike.distance_meters - c.installed_bike_meters;
  const virtual = bike.virtual_meters - c.installed_bike_virtual_meters;
  const raw = c.starting_wear_meters + total - (c.counts_virtual ? 0 : virtual);
  return Math.max(0, raw) * c.wear_multiplier;
}

// Latest checkpoint at or below the current wear
export function latestCheckpoint(wear: number, first: number, repeat: number | null) {
  if (wear < first) return null;
  if (!repeat) return first;
  return first + Math.floor((wear - first) / repeat) * repeat;
}

// Returns the checkpoint to alert on, or null if nothing new
export function checkpointToAlert(
  wear: number, first: number, repeat: number | null, lastAlerted: number | null
) {
  const cp = latestCheckpoint(wear, first, repeat);
  return cp !== null && cp > (lastAlerted ?? 0) ? cp : null;
}

export function nextCheckpoint(wear: number, first: number, repeat: number | null) {
  if (wear < first) return first;
  const cur = latestCheckpoint(wear, first, repeat);
  return repeat && cur !== null ? cur + repeat : null;
}

export type Units = 'mi' | 'km';

export function toUnits(meters: number, units: Units = 'mi') {
  return units === 'mi' ? meters / METERS_PER_MILE : meters / 1000;
}