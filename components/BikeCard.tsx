// components/BikeCard.tsx
'use client';

import { useState } from 'react';

interface BikeCardProps {
  bike: any;
  components: any[];
  athleteId?: string;
}

export default function BikeCard({ bike, components }: BikeCardProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold">{bike.name}</h3>
          <p className="text-sm text-gray-500">
            Total Distance: {((bike.converted_distance || 0)).toFixed(0)} miles
          </p>
        </div>
        {bike.primary && (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
            Primary
          </span>
        )}
      </div>

      {/* Components List */}
      <div className="space-y-3 mt-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Tracked Components
        </h4>
        {components.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No tracked parts yet (chain, tires, sealant, etc.)</p>
        ) : (
          components.map((comp) => {
            const pct = Math.min(
              100,
              Math.round((comp.current_wear_units / comp.base_threshold_miles) * 100)
            );
            return (
              <div key={comp.id} className="text-sm bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-100 dark:border-gray-800">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{comp.name}</span>
                  <span className="text-xs text-gray-500">
                    {comp.current_wear_units} / {comp.base_threshold_miles} mi
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${pct > 85 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
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