'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { wearMeters, latestCheckpoint, nextCheckpoint, toUnits, Units } from '@/lib/wear';

interface Props {
  comp: any;
  bike: any;
  units: Units;
}

export default function ComponentRow({ comp, bike, units }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [first, setFirst] = useState('');
  const [repeat, setRepeat] = useState('');

  const round = (m: number) => Math.round(toUnits(m, units));
  const fmt = (m: number) => round(m).toLocaleString();

  const wear = wearMeters(
    { distance_meters: bike.distance_meters || 0, virtual_meters: bike.virtual_meters || 0 },
    comp
  );
  const firstCheck = comp.max_distance_meters;
  const repeatEvery = comp.repeat_every_meters ?? null;
  const reached = latestCheckpoint(wear, firstCheck, repeatEvery);
  const next = nextCheckpoint(wear, firstCheck, repeatEvery);
  const pct = next ? Math.min(100, (wear / next) * 100) : 100;
  const due = reached !== null;

  async function save(payload: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/components/${comp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ units, ...payload }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Save failed');
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  function startEditing() {
    setFirst(String(round(firstCheck)));
    setRepeat(repeatEvery ? String(round(repeatEvery)) : '');
    setError('');
    setEditing(true);
  }

  return (
    <div className="text-sm bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-100 dark:border-gray-800">
      <div className="flex justify-between mb-1">
        <span className="font-medium">{comp.name}</span>
        <span className="text-xs text-gray-500">
          {fmt(wear)} {units}
          {comp.wear_multiplier !== 1 && ` (×${comp.wear_multiplier} wear-adjusted)`}
        </span>
      </div>

      <div className="flex justify-between text-[11px] text-gray-400 mb-1">
        <span>0</span>
        <span>{next ? `check at ${fmt(next)}` : ''}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${due ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-1 text-[11px] text-gray-500">
        {due ? 'Check recommended. ' : ''}
        {!comp.baseline_confirmed ? 'Estimate: assumes the original part.' : ''}
      </div>

      {comp.component_type === 'brake_pads' && (
        <div className="flex items-center gap-2 mt-2 text-[11px]">
          <span className="text-gray-500">Brake type:</span>
          {(['rim', 'disc'] as const).map((v) => (
            <button
              key={v}
              disabled={saving}
              onClick={() => comp.variant !== v && save({ variant: v })}
              className={`px-2 py-0.5 rounded border ${
                comp.variant === v
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {v === 'rim' ? 'Rim' : 'Disc'}
            </button>
          ))}
          {!comp.variant && <span className="text-amber-600">Not set: using a middle estimate</span>}
        </div>
      )}

      {!editing ? (
        <button onClick={startEditing} className="mt-2 text-[11px] text-orange-600 font-semibold hover:underline">
          Edit thresholds
        </button>
      ) : (
        <div className="mt-2 space-y-2 border-t pt-2">
          <div className="flex gap-3">
            <label className="text-[11px] text-gray-500">
              First check ({units})
              <input
                type="number"
                min="1"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                className="block w-28 mt-0.5 p-1 border rounded text-black bg-white"
              />
            </label>
            <label className="text-[11px] text-gray-500">
              Then every ({units})
              <input
                type="number"
                min="0"
                placeholder="once only"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className="block w-28 mt-0.5 p-1 border rounded text-black bg-white"
              />
            </label>
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={() => save({ first_check: first, repeat_every: repeat === '' ? null : repeat })}
              className="px-2 py-1 text-[11px] font-bold bg-black text-white rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="px-2 py-1 text-[11px] text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}