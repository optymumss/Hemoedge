import { createClient } from "@/lib/supabase/server";
import { createCase } from "../actions";
import { DetailsForm } from "../[id]/details-form";

export default async function NewCasePage() {
  const supabase = await createClient();
  const { data: slides } = await supabase.from("slides").select("id, title").order("title");

  return (
    <div>
      <h1 className="text-xl font-semibold">New case study</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Fill in the case&apos;s details, then Save to create it as a draft. Media, tags, and
        linked features/modules/slides can be added afterward.
      </p>

      <div className="mt-6">
        <DetailsForm action={createCase} slides={slides ?? []} />
      </div>
    </div>
  );
}
