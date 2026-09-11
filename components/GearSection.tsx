// components/GearSection.tsx
'use client';

import BikeCard from './BikeCard';

interface GearSectionProps {
  title: string;
  type: 'bikes' | 'shoes' | 'winter_sports';
  items?: any[];
  components?: any[];
  customItems?: any[];
  athleteId?: string;
  allowCustomAdd?: boolean;
}

export default function GearSection({
  title,
  type,
  items = [],
  components = [],
  customItems = [],
  athleteId,
  allowCustomAdd = false,
}: GearSectionProps) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        {allowCustomAdd && (
          <button className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition">
            + Add Custom Gear
          </button>
        )}
      </div>

      {type === 'bikes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((bike) => (
            <BikeCard
              key={bike.id}
              bike={bike}
              components={components.filter((c) => c.strava_gear_id === bike.id)}
              athleteId={athleteId}
            />
          ))}
        </div>
      )}

      {type === 'shoes' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((shoe) => (
            <div key={shoe.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-semibold">{shoe.name}</h3>
              <p className="text-sm text-gray-500">{(shoe.converted_distance || 0).toFixed(0)} miles</p>
            </div>
          ))}
        </div>
      )}

      {type === 'winter_sports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {customItems.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No skis or snowboards added yet.</p>
          ) : (
            customItems.map((item) => (
              <div key={item.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.category}</p>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}