import { getCurrentProfile } from "@/lib/auth/get-profile";

export default async function LearnerHome() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <h1 className="text-xl font-semibold">
        Welcome, {profile?.fullName || profile?.email}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-neutral-600">
        Continue learning, recommended modules, quiz scores, and weak areas
        will live here.
      </p>
    </div>
  );
}
