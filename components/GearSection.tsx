// components/GearSection.tsx
'use client';

import { useState } from 'react';
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(type === 'winter_sports' ? 'skis' : 'shoes');
  const [loading, setLoading] = useState(false);

  async function handleAddGear(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/gear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category }),
    });

    if (res.ok) {
      setName('');
      setShowAddForm(false);
      window.location.reload(); // Refresh page to display newly saved gear
    } else {
      alert('Failed to save gear. Please check your network tab or database permissions.');
    }
    setLoading(false);
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        {allowCustomAdd && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition"
          >
            {showAddForm ? 'Cancel' : '+ Add Custom Gear'}
          </button>
        )}
      </div>

      {/* ADD GEAR MODAL / FORM */}
      {showAddForm && (
        <form onSubmit={handleAddGear} className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3 border">
          <div>
            <label className="block text-xs font-semibold mb-1">Gear Name</label>
            <input
              type="text"
              placeholder="e.g. Salomon QST 106 Skis or Hoka Clifton 9"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full text-sm p-2 border rounded bg-white text-black"
            />
          </div>

          {type === 'winter_sports' && (
            <div>
              <label className="block text-xs font-semibold mb-1">Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm p-2 border rounded bg-white text-black"
              >
                <option value="skis">Skis</option>
                <option value="snowboard">Snowboard</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-bold bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Gear'}
          </button>
        </form>
      )}

      {/* BICYCLES */}
      {type === 'bikes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No bikes found in Strava. Add bikes under Strava Settings -&gt; My Gear.</p>
          ) : (
            items.map((bike) => (
              <BikeCard
                key={bike.id}
                bike={bike}
                components={components.filter((c) => c.strava_gear_id === bike.id)}
                athleteId={athleteId}
              />
            ))
          )}
        </div>
      )}

      {/* RUNNING SHOES */}
      {type === 'shoes' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.length === 0 && customItems.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No shoes added yet.</p>
          ) : (
            <>
              {items.map((shoe) => (
                <div key={shoe.id} className="p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-semibold">{shoe.name}</h3>
                  <p className="text-sm text-gray-500">{(shoe.converted_distance || 0).toFixed(0)} miles (Strava)</p>
                </div>
              ))}
              {customItems.map((shoe) => (
                <div key={shoe.id} className="p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-semibold">{shoe.name}</h3>
                  <p className="text-sm text-gray-500">Custom Shoe</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* WINTER SPORTS */}
      {type === 'winter_sports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {customItems.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No skis or snowboards added yet. Click "+ Add Custom Gear" above!</p>
          ) : (
            customItems.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-xs uppercase text-orange-600 font-bold mt-1">{item.category}</p>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}