import { useLiveQuery } from "dexie-react-hooks";
import { db, getMeta } from "../../lib/db";
import { useProfile } from "../../lib/hooks";
import { Banner, PageHeader } from "../../components/ui";
import { Markdown } from "../../components/Markdown";

export function Booking() {
  const profile = useProfile();
  const data = useLiveQuery(async () => ({ md: await getMeta<string | null>("booking_md"), config: profile ? await db.configs.get(profile.country) : undefined }), [profile?.country]);
  if (!data) return null;
  return (
    <div>
      <PageHeader title="Exam booking guide" back="/more" />
      {data.config?.status !== "reviewed" && <Banner tone="warn">Draft guide. Steps, fees and documents must be confirmed with {data.config?.authority ?? "the authority"} before you rely on them.</Banner>}
      <div className="card">{data.md ? <Markdown>{data.md}</Markdown> : <p>No guide available for this country yet.</p>}</div>
      {data.config && (
        <div className="card mt-3 text-sm">
          <h2 className="h2 mb-1">Required courses (listed so far)</h2>
          {data.config.eligibility.required_courses.length ? (
            <ul className="list-disc pl-5">
              {data.config.eligibility.required_courses.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p>Not confirmed.</p>
          )}
        </div>
      )}
    </div>
  );
}
