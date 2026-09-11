// app/dashboard/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import GearSection from '@/components/GearSection';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getDashboardData(athleteId: string) {
  // 1. Fetch tokens from Supabase
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('strava_athlete_id', athleteId)
    .single();

  if (!user) return null;

  // 2. Fetch Athlete Profile & Native Gear from Strava API
  const stravaRes = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${user.access_token}` },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  const athlete = await stravaRes.json();

  // 3. Fetch custom bike components & custom gear from Supabase
  const { data: bikeComponents } = await supabase
    .from('bike_components')
    .select('*')
    .eq('user_id', athleteId)
    .eq('is_retired', false);

  const { data: customGear } = await supabase
    .from('custom_gear')
    .select('*')
    .eq('user_id', athleteId);

  return {
    athlete,
    bikes: athlete.bikes || [],
    shoes: athlete.shoes || [],
    bikeComponents: bikeComponents || [],
    customGear: customGear || [],
  };
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const athleteId = cookieStore.get('strava_session')?.value;

  if (!athleteId) {
    redirect('/api/auth/strava');
  }

  const data = await getDashboardData(athleteId);

  if (!data) {
    redirect('/api/auth/strava');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="flex items-center gap-4 mb-8">
        <img
          src={data.athlete.profile}
          alt={data.athlete.firstname}
          className="w-16 h-16 rounded-full border-2 border-orange-500"
        />
        <div>
          <h1 className="text-2xl font-bold">
            {data.athlete.firstname} {data.athlete.lastname}’s Garage
          </h1>
          <p className="text-gray-500 text-sm">Manage gear, bikes, and component lifespans</p>
        </div>
      </header>

      <div className="space-y-8">
        {/* BICYCLES & COMPONENTS */}
        <GearSection
          title="Bicycles"
          type="bikes"
          items={data.bikes}
          components={data.bikeComponents}
          athleteId={athleteId}
        />

        {/* RUNNING SHOES */}
        <GearSection
          title="Running Shoes"
          type="shoes"
          items={data.shoes}
          customItems={data.customGear.filter((g) => g.category === 'shoes')}
        />

        {/* SKIS & SNOWBOARDS */}
        <GearSection
          title="Skis & Snowboards"
          type="winter_sports"
          customItems={data.customGear.filter((g) => ['skis', 'snowboard'].includes(g.category))}
          athleteId={athleteId}
          allowCustomAdd
        />
      </div>
    </div>
  );
}