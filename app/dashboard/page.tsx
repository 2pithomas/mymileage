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

  // 3. Fetch fresh Athlete Profile & Native Gear directly from Strava
  let athlete = null;
  try {
    const stravaRes = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store', // Always fetch fresh data on page load
    });

    if (stravaRes.ok) {
      athlete = await stravaRes.json();
    }
  } catch (err) {
    console.error('Strava API fetch error:', err);
  }

  // Fallback profile picture from database if API call returns null
  const profilePic = athlete?.profile || athlete?.profile_medium || user.profile_picture || '';
  const firstName = athlete?.firstname || user.firstname || 'Athlete';
  const lastName = athlete?.lastname || user.lastname || '';

  // 4. Fetch custom bike components & custom gear from Supabase
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
    bikes: athlete?.bikes || [],
    shoes: athlete?.shoes || [],
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