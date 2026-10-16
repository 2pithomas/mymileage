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
  const [mode, setMode] = useState<'view' | 'edit' | 'replace'>('view');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [first, setFirst] = useState('');
  const [repeat, setRepeat] = useState('');
  const [variant, setVariant] = useState('');
  const [newName, setNewName] = useState('');
  const [lifespan, setLifespan] = useState('');

  const isBrakes = comp.component_type === 'brake_pads';
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

  const initialFirst = String(round(firstCheck));
  const initialRepeat = repeatEvery ? String(round(repeatEvery)) : '';

  async function call(url: string, method: 'PATCH' | 'POST', payload: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ units, ...payload }),
      });
      if (res.ok) {
        setMode('view');
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Request failed (${res.status})`);
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  function startEdit() {
    setFirst(initialFirst);
    setRepeat(initialRepeat);
    setVariant(comp.variant ?? '');
    setError('');
    setMode('edit');
  }

  function startReplace() {
    setNewName('');
    setLifespan('');
    setError('');
    setMode('replace');
  }

  function saveEdit() {
    const payload: Record<string, unknown> = {};
    if (isBrakes && variant && variant !== (comp.variant ?? '')) payload.variant = variant;
    if (first !== initialFirst) payload.first_check = first;
    if (repeat !== initialRepeat) payload.repeat_every = repeat === '' ? null : repeat;

    if (Object.keys(payload).length === 0) {
      setMode('view');
      return;
    }
    call(`/api/components/${comp.id}`, 'PATCH', payload);
  }

  function submitReplace() {
    call(`/api/components/${comp.id}/replace`, 'POST', {
      new_name: newName,
      reported_lifespan: lifespan === '' ? null : lifespan,
    });
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
        {!comp.baseline_confirmed ? 'Estimate: assumes the original part. ' : ''}
        {isBrakes && !comp.variant ? 'Rim or disc? Choose under Edit thresholds.' : ''}
      </div>

      {mode === 'view' && (
        <div className="mt-2 flex gap-3 text-[11px] font-semibold">
          <button onClick={startEdit} className="text-orange-600 hover:underline">
            Edit thresholds
          </button>
          <button onClick={startReplace} className="text-orange-600 hover:underline">
            Replace
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <div className="mt-2 space-y-2 border-t pt-2">
          {isBrakes && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-gray-500">Brake type:</span>
              {(['rim', 'disc'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariant(v)}
                  className={`px-2 py-0.5 rounded border ${
                    variant === v
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {v === 'rim' ? 'Rim' : 'Disc'}
                </button>
              ))}
            </div>
          )}
          {isBrakes && variant && variant !== (comp.variant ?? '') && (
            <p className="text-[11px] text-gray-500">
              Thresholds switch to the {variant} defaults unless you have customized them or change the numbers below.
            </p>
          )}

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
              onClick={saveEdit}
              className="px-2 py-1 text-[11px] font-bold bg-black text-white rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setMode('view')} className="px-2 py-1 text-[11px] text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'replace' && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <p className="text-[11px] text-gray-500">
            This starts a new {comp.name.toLowerCase()} at 0 from today. Your thresholds carry over, and the old one is kept in your history.
          </p>
          <label className="block text-[11px] text-gray-500">
            New part (optional)
            <input
              type="text"
              placeholder="e.g. SRAM Force E1 chain"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="block w-full mt-0.5 p-1 border rounded text-black bg-white"
            />
          </label>
          <label className="block text-[11px] text-gray-500">
            How far did the old one last? (optional, {units})
            <input
              type="number"
              min="0"
              value={lifespan}
              onChange={(e) => setLifespan(e.target.value)}
              className="block w-28 mt-0.5 p-1 border rounded text-black bg-white"
            />
          </label>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={submitReplace}
              className="px-2 py-1 text-[11px] font-bold bg-black text-white rounded disabled:opacity-50"
            >
              {saving ? 'Replacing...' : 'Confirm replace'}
            </button>
            <button onClick={() => setMode('view')} className="px-2 py-1 text-[11px] text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}