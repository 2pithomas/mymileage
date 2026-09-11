// app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-3xl font-bold">Welcome to MyMileage!</h1>
      <p className="mt-4 text-gray-600">
        Your Strava account is connected. Component tracking and sync coming soon!
      </p>
    </main>
  );
}