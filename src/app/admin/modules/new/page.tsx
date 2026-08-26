import { createModule } from "../actions";
import { DetailsForm } from "../[id]/details-form";

export default function NewModulePage() {
  return (
    <div>
      <h1 className="text-lg font-semibold">New module</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Fill in the module&apos;s details, then Save to create it as a draft. Media, tags,
        lessons, and quiz questions can be added afterward.
      </p>

      <div className="mt-6">
        <DetailsForm action={createModule} />
      </div>
    </div>
  );
}
