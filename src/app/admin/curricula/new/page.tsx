import { createCurriculum } from "../actions";
import { DetailsForm } from "../[id]/details-form";

export default function NewCurriculumPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">New learning pathway</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Fill in the pathway&apos;s details, then Save to create it as a draft. Modules can be
        added to it afterward.
      </p>

      <div className="mt-6">
        <DetailsForm action={createCurriculum} />
      </div>
    </div>
  );
}
