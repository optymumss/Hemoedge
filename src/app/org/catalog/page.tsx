import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { ComingSoon } from "@/components/coming-soon";
import { CatalogToggle } from "./catalog-toggle";

export default async function CatalogPage() {
  const org = await getCurrentOrg();
  if (!org) {
    return (
      <ComingSoon
        title="No organization assigned"
        description="This account isn't set as an owner/admin of any organization yet."
      />
    );
  }

  const supabase = await createClient();
  const [{ data: modules }, { data: cases }, { data: curricula }, { data: selections }] =
    await Promise.all([
      supabase.from("modules").select("id, title, level").eq("status", "published"),
      supabase.from("cases").select("id, title, level").eq("status", "published"),
      supabase
        .from("curricula")
        .select("id, title, level")
        .eq("status", "published"),
      supabase
        .from("org_catalog_selections")
        .select("content_type, content_id")
        .eq("org_id", org.id),
    ]);

  const selectedKeys = new Set(
    (selections ?? []).map((s) => `${s.content_type}:${s.content_id}`),
  );

  const sections: {
    label: string;
    type: "module" | "case" | "curriculum";
    items: { id: string; title: string; level: string }[];
  }[] = [
    { label: "Modules", type: "module", items: modules ?? [] },
    { label: "Cases", type: "case", items: cases ?? [] },
    { label: "Curricula", type: "curriculum", items: curricula ?? [] },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">Catalog — {org.name}</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Cherry-pick which published modules, cases, and curricula your organization teaches.
      </p>

      <div className="mt-6 flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.type}>
            <h2 className="text-sm font-semibold text-ink">{section.label}</h2>
            <div className="mt-2 overflow-hidden rounded-lg border border-line">
              <table className="w-full text-sm">
                <tbody>
                  {section.items.map((item) => {
                    const selected = selectedKeys.has(`${section.type}:${item.id}`);
                    return (
                      <tr key={item.id} className="border-t border-line first:border-t-0">
                        <td className="px-4 py-2 font-medium">{item.title}</td>
                        <td className="px-4 py-2 capitalize text-ink-dim">{item.level}</td>
                        <td className="px-4 py-2 text-right">
                          <CatalogToggle
                            orgId={org.id}
                            contentType={section.type}
                            contentId={item.id}
                            selected={selected}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {section.items.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-ink-faint">
                        Nothing published yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
