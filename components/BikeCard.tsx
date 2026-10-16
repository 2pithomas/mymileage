'use client';

import { useState } from 'react';
import { wearMeters, latestCheckpoint, nextCheckpoint, toUnits, Units } from '@/lib/wear';

interface BikeCardProps {
  bike: any;
  components: any[];
  athleteId?: string;
  units?: Units;
}

export default function BikeCard({ bike, components, units = 'mi' }: BikeCardProps) {
  const [showForm, setShowForm] = useState(false);
  const fmt = (m: number) => Math.round(toUnits(m, units)).toLocaleString();

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold">{bike.name}</h3>
          <p className="text-sm text-gray-500">
            Total Distance: {fmt(bike.distance_meters || 0)} {units}
          </p>
        </div>
        {bike.primary_gear && (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
            Primary
          </span>
        )}
      </div>

      <div className="space-y-3 mt-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Tracked Components
        </h4>

        {bike.track_components === false ? (
          <p className="text-xs text-gray-500 italic">Component tracking is off for this bike.</p>
        ) : components.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No tracked parts yet.</p>
        ) : (
          components.map((comp) => {
            const wear = wearMeters(
              { distance_meters: bike.distance_meters || 0, virtual_meters: bike.virtual_meters || 0 },
              comp
            );
            const first = comp.max_distance_meters;
            const repeat = comp.repeat_every_meters ?? null;
            const reached = latestCheckpoint(wear, first, repeat);
            const next = nextCheckpoint(wear, first, repeat);
            const pct = next ? Math.min(100, (wear / next) * 100) : 100;
            const due = reached !== null;

            return (
              <div key={comp.id} className="text-sm bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-100 dark:border-gray-800">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{comp.name}</span>
                  <span className="text-xs text-gray-500">
                    {fmt(wear)} {units}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                  <span>0</span>
                  <span>{next ? `check at ${fmt(next)}` : ''}</span>
                </div>
                <div className="relative w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${due ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {due ? 'Check recommended. ' : ''}
                  {!comp.baseline_confirmed ? 'Estimate: assumes the original part.' : ''}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="mt-4 text-xs text-orange-600 font-semibold hover:underline"
      >
        {showForm ? 'Cancel' : '+ Attach New Component'}
      </button>
    </div>
  );
}