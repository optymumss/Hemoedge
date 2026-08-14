import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { computeAssigneeProgress } from "@/lib/org/onboarding-progress";
import { addItem, removeItem, assignLearner, unassignLearner } from "./actions";

export default async function OnboardingPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) {
    return <p className="text-sm text-ink-dim">No organization assigned.</p>;
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("onboarding_plans")
    .select("id, name, description, org_id")
    .eq("id", id)
    .single();

  if (!plan) {
    return <p className="text-sm text-ink-dim">Plan not found.</p>;
  }

  const [{ data: items }, { data: allModules }, { data: allPathways }, { data: assignments }, { data: members }] =
    await Promise.all([
      supabase
        .from("onboarding_plan_items")
        .select("id, module_id, curriculum_id, modules(title), curricula(title)")
        .eq("plan_id", id)
        .order("position"),
      supabase.from("modules").select("id, title").eq("status", "published").order("title"),
      supabase.from("curricula").select("id, title").eq("status", "published").order("title"),
      supabase
        .from("onboarding_assignments")
        .select("id, user_id, due_date, profiles!onboarding_assignments_user_id_fkey(full_name, email)")
        .eq("plan_id", id),
      supabase
        .from("organization_memberships")
        .select("user_id, profiles(full_name, email)")
        .eq("org_id", org.id),
    ]);

  const assignedIds = new Set((assignments ?? []).map((a) => a.user_id));
  const availableMembers = (members ?? []).filter((m) => !assignedIds.has(m.user_id));

  const progressByAssignee = await Promise.all(
    (assignments ?? []).map(async (a) => ({
      assignment: a,
      progress: await computeAssigneeProgress(supabase, a.user_id, items ?? []),
    })),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold">{plan.name}</h1>
      {plan.description && <p className="mt-1 text-sm text-ink-dim">{plan.description}</p>}

      <div className="mt-6 rounded-lg border border-line p-4">
        <h2 className="text-sm font-semibold">Plan items</h2>
        <div className="mt-2 flex flex-col gap-2">
          {(items ?? []).map((item, i) => (
            <div key={item.id} className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-1.5 text-sm">
              <span>
                {i + 1}. {item.modules?.title ?? item.curricula?.title}{" "}
                {item.curriculum_id && <span className="text-xs text-ink-faint">(Pathway)</span>}
              </span>
              <form action={removeItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="plan_id" value={plan.id} />
                <button type="submit" className="text-xs text-danger underline">
                  Remove
                </button>
              </form>
            </div>
          ))}
          {(items ?? []).length === 0 && <p className="text-sm text-ink-faint">No items yet.</p>}
        </div>
        <form action={addItem} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="plan_id" value={plan.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim" htmlFor="item-target">Add a module or pathway</label>
            <select
              id="item-target"
              name="target"
              required
              defaultValue=""
              className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            >
              <option value="" disabled>Choose…</option>
              <optgroup label="Modules">
                {(allModules ?? []).map((m) => (
                  <option key={`m_${m.id}`} value={`module:${m.id}`}>{m.title}</option>
                ))}
              </optgroup>
              <optgroup label="Learning Pathways">
                {(allPathways ?? []).map((p) => (
                  <option key={`p_${p.id}`} value={`curriculum:${p.id}`}>{p.title}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <button type="submit" className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken">
            Add
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-lg border border-line p-4">
        <h2 className="text-sm font-semibold">Assign to a learner</h2>
        <form action={assignLearner} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="plan_id" value={plan.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim" htmlFor="assign-user">Learner</label>
            <select
              id="assign-user"
              name="user_id"
              required
              defaultValue=""
              className="w-56 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            >
              <option value="" disabled>Choose…</option>
              {availableMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profiles?.full_name || m.profiles?.email}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-dim" htmlFor="assign-due">Due date (optional)</label>
            <input
              id="assign-due"
              name="due_date"
              type="date"
              className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken">
            Assign
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Learner</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {progressByAssignee.map(({ assignment, progress }) => {
              const doneCount = progress.filter((p) => p.done).length;
              return (
                <tr key={assignment.id} className="border-t border-line align-top">
                  <td className="px-4 py-2 font-medium">
                    {assignment.profiles?.full_name || assignment.profiles?.email}
                  </td>
                  <td className="px-4 py-2 text-ink-dim">{assignment.due_date ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-dim">
                    {doneCount}/{progress.length} complete
                    <div className="mt-1 flex flex-wrap gap-1">
                      {progress.map((p) => (
                        <span
                          key={p.itemId}
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            p.done ? "bg-success-soft text-success-soft-ink" : "bg-surface-sunken text-ink-faint"
                          }`}
                        >
                          {p.label}
                          {p.fraction ? ` (${p.fraction})` : ""}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={unassignLearner}>
                      <input type="hidden" name="id" value={assignment.id} />
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <button type="submit" className="text-xs text-danger underline">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {progressByAssignee.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  No one assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
