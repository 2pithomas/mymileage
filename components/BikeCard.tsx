'use client';

import { useState } from 'react';
import { toUnits, Units } from '@/lib/wear';
import ComponentRow from './ComponentRow';

interface BikeCardProps {
  bike: any;
  components: any[];
  athleteId?: string;
  units?: Units;
}

export default function BikeCard({ bike, components, units = 'mi' }: BikeCardProps) {
  const [showForm, setShowForm] = useState(false);
  const total = Math.round(toUnits(bike.distance_meters || 0, units)).toLocaleString();

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold">{bike.name}</h3>
          <p className="text-sm text-gray-500">
            Total Distance: {total} {units}
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
          components.map((comp) => (
            <ComponentRow key={comp.id} comp={comp} bike={bike} units={units} />
          ))
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