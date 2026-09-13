// app/dashboard/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import GearSection from '@/components/GearSection';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getValidAccessToken(user: any) {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  // Return existing token if it's still valid for at least 5 minutes
  if (user.expires_at && user.expires_at > nowInSeconds + 300) {
    return user.access_token;
  }

  // Token is expired -> Refresh it with Strava
  try {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: user.refresh_token,
      }),
    });

    const refreshed = await refreshRes.json();

    if (refreshed.access_token) {
      await supabase
        .from('users')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: refreshed.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('strava_athlete_id', user.strava_athlete_id);

      return refreshed.access_token;
    }
  } catch (err) {
    console.error('Failed to refresh Strava token:', err);
  }

  return user.access_token;
}

async function getDashboardData(athleteId: string) {
  // 1. Fetch user tokens & stored profile from Supabase
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('strava_athlete_id', athleteId)
    .single();

  if (!user) return null;

  // 2. Ensure access token is valid
  const accessToken = await getValidAccessToken(user);

// 3. Fetch Athlete Profile & Gear Summary from Strava API
  let athlete = null;
  try {
    const stravaRes = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });

    if (stravaRes.ok) {
      athlete = await stravaRes.json();
    }
  } catch (err) {
    console.error('Strava API fetch error:', err);
  }

  const profilePic = athlete?.profile || athlete?.profile_medium || user.profile_picture || '';
  const firstName = athlete?.firstname || user.firstname || 'Athlete';
  const lastName = athlete?.lastname || user.lastname || '';

  // Fetch full details via getGearById for each bike and upsert into Supabase
  const summaryBikes = athlete?.bikes || [];
  const detailedBikes = await Promise.all(
    summaryBikes.map(async (bikeSummary: { id: string }) => {
      try {
        const gearRes = await fetch(`https://www.strava.com/api/v3/gear/${bikeSummary.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          next: { revalidate: 3600 },
        });
        if (gearRes.ok) {
          return await gearRes.json();
        }
      } catch (err) {
        console.error(`Error fetching bike gear ${bikeSummary.id}:`, err);
      }
      return bikeSummary;
    })
  );

  // Fetch full details via getGearById for each shoe and upsert into Supabase
  const summaryShoes = athlete?.shoes || [];
  const detailedShoes = await Promise.all(
    summaryShoes.map(async (shoeSummary: { id: string }) => {
      try {
        const gearRes = await fetch(`https://www.strava.com/api/v3/gear/${shoeSummary.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          next: { revalidate: 3600 },
        });
        if (gearRes.ok) {
          return await gearRes.json();
        }
      } catch (err) {
        console.error(`Error fetching shoe gear ${shoeSummary.id}:`, err);
      }
      return shoeSummary;
    })
  );

  // Sync detailed gear records into Supabase tables
  if (detailedBikes.length > 0) {
    await supabase.from('bikes').upsert(
      detailedBikes.map((b) => ({
        id: b.id,
        user_id: athleteId,
        name: b.name || `${b.brand_name || ''} ${b.model_name || ''}`.trim(),
        brand_name: b.brand_name || null,
        model_name: b.model_name || null,
        frame_type: b.frame_type || null,
        description: b.description || null,
        distance_meters: b.distance || 0,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );
  }

  if (detailedShoes.length > 0) {
    await supabase.from('shoes').upsert(
      detailedShoes.map((s) => ({
        id: s.id,
        user_id: athleteId,
        name: s.name || `${s.brand_name || ''} ${s.model_name || ''}`.trim(),
        brand_name: s.brand_name || null,
        model_name: s.model_name || null,
        description: s.description || null,
        distance_meters: s.distance || 0,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );
  }

  // 4. Fetch stored Bikes, Shoes, Components, and Custom Gear directly from Supabase
  const { data: dbBikes } = await supabase
    .from('bikes')
    .select('*')
    .eq('user_id', athleteId);

  const { data: dbShoes } = await supabase
    .from('shoes')
    .select('*')
    .eq('user_id', athleteId);

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
    athlete: {
      ...athlete,
      profile: profilePic,
      firstname: firstName,
      lastname: lastName,
    },
    bikes: dbBikes || detailedBikes,
    shoes: dbShoes || detailedShoes,
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
        {data.athlete.profile ? (
          <img
            src={data.athlete.profile}
            alt={data.athlete.firstname}
            className="w-16 h-16 rounded-full border-2 border-orange-500 object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full border-2 border-orange-500 bg-orange-100 flex items-center justify-center font-bold text-orange-600 text-xl">
            {data.athlete.firstname[0]}
          </div>
        )}
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