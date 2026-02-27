import { useMemo } from "react";
import { Page, sidenavItems } from "../../components/page";
import { useShopJobsQuery } from "../../lib/jobs-orpc";
import { useShopRoute } from "../useShopRoute";

export function ShopJobDetailRoute({ navigate, shopId, jobId }) {
  const { session, isPending, activeShop, isLoading } = useShopRoute({
    navigate,
    shopId,
  });
  const pageShopId = activeShop?.id ?? shopId;
  const {
    data: jobsData,
    error: jobsError,
    isLoading: isLoadingJobs,
  } = useShopJobsQuery({
    shopId: pageShopId,
    enabled: !!activeShop,
  });
  const job = useMemo(() => {
    if (!jobId || !jobsData?.jobs) {
      return null;
    }

    return jobsData.jobs.find((jobEntry) => jobEntry.id === jobId) ?? null;
  }, [jobId, jobsData]);
  const pageLoading =
    isLoading || !activeShop || (!!activeShop && isLoadingJobs && !jobsData);

  if (!isPending && !session) {
    return null;
  }

  return (
    <Page
      title={job?.name ?? "Job"}
      shopId={pageShopId}
      loading={pageLoading || !activeShop}
      sidenavItems={sidenavItems({
        activePage: "jobs",
        shopId: pageShopId,
        showSettings: activeShop?.role === "ADMIN",
      })}
      breadcrumbs={
        activeShop
          ? [
              {
                label: "Shops",
                href: "/shop",
              },
              {
                label: activeShop.name,
                href: "/shop/" + activeShop.id,
              },
              {
                label: "Jobs",
                href: "/shop/" + activeShop.id + "/jobs",
              },
              {
                label: job?.name ?? "Job",
                href: "/shop/" + activeShop.id + "/jobs/" + jobId,
              },
            ]
          : []
      }
    >
      <main style={{ display: "grid", gap: 12 }}>
        <button
          type="button"
          onClick={() => navigate("/shop/" + pageShopId + "/jobs")}
        >
          Back to jobs
        </button>

        {jobsError ? (
          <p>Unable to load jobs right now: {jobsError.message ?? "Unknown error"}</p>
        ) : null}

        {!jobsError && !pageLoading && !job ? <p>Job not found.</p> : null}

        {job ? (
          <>
            <h1>{job.name}</h1>
            <h2>Parts</h2>
            {job.parts.length === 0 ? (
              <p>No parts on this job yet.</p>
            ) : (
              <ul>
                {job.parts.map((part) => (
                  <li key={part.id}>
                    {part.code}: {part.name}
                  </li>
                ))}
              </ul>
            )}
            <pre>{JSON.stringify(job, null, 2)}</pre>
          </>
        ) : null}
      </main>
    </Page>
  );
}
