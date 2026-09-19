import { getGreeting, firstName } from "@/lib/greeting";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderSearch } from "@/components/header-search";
import { NotificationBell } from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications/get-notifications";

export async function Header({ identity }: { identity: string }) {
  const greeting = getGreeting(new Date(), firstName(identity));
  const supabase = await createClient();
  const { notifications, lastViewedAt } = await getNotifications(supabase);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-4 sm:px-8">
      <div>
        <p className="text-lg font-semibold text-ink">{greeting}</p>
        <p className="text-sm text-ink-dim">You&apos;re doing great — keep up the momentum.</p>
      </div>

      <div className="flex items-center gap-3">
        <HeaderSearch />
        <NotificationBell notifications={notifications} lastViewedAt={lastViewedAt} />
        <ThemeToggle />
      </div>
    </header>
  );
}
