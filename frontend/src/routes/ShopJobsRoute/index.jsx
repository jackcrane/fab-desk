import { Page, sidenavItems } from "../../components/page";
import { useShopRoute } from "../useShopRoute";
import jobsData from "../../mock-data/jobs.json";
import { Checkbox, SegmentedControl, Select } from "@jackcrane/ui";
import styles from "./shop.module.css";

export const MOCK_JOBS = jobsData;

export function ShopJobsRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading } = useShopRoute({
    navigate,
    shopId,
  });
  const pageShopId = activeShop?.id ?? shopId;
  const pageLoading = isLoading || !activeShop;

  if (!isPending && !session) {
    return null;
  }

  return (
    <Page
      title="Jobs"
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
            ]
          : []
      }
    >
      <main>
        <SegmentedControl
          options={[
            { label: "List", value: "list" },
            { label: "Calendar", value: "calendar" },
            { label: "Kanban", value: "kanban" },
            { label: "Gantt", value: "gantt" },
          ]}
          value="list"
        />

        <table className={styles.table}>
          <thead className="jcui_chamfer">
            <tr className="jcui_hatch">
              <th>Status</th>
              <th>Job</th>
              <th>Customer/Requestor</th>
              <th>Priority</th>
              <th>Due Date</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_JOBS.jobs.map((job) => (
              <tr key={job.id} className={styles.job}>
                <td>{JobStatusPicker(job)}</td>
                <td>{job.name}</td>
                <td>{job.customer}</td>
                <td>
                  <div
                    style={{
                      color:
                        job.priority === "High"
                          ? "var(--danger-color-500)"
                          : job.priority === "Medium"
                            ? "var(--warning-color-500)"
                            : "var(--success-color-500)",
                      width: 12,
                      display: "inline-block",
                      textAlign: "right",
                    }}
                  >
                    {job.priority === "High"
                      ? "!!!"
                      : job.priority === "Medium"
                        ? "!!"
                        : "!"}
                  </div>{" "}
                  {job.priority}
                </td>
                <td>{new Date(job.dueDate).toLocaleDateString()}</td>
                <td>{job.assignee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </Page>
  );
}

function JobStatusPicker(job) {
  const VARIANT_LUT = {
    DRAFT: "secondary",
    QUEUED: "warning",
    IN_PRODUCTION: "primary",
    BLOCKED: "danger",
    COMPLETED: "info",
    READY_FOR_PICKUP: "success",
  };

  return (
    <Select
      options={[
        {
          label: "Draft",
          value: "DRAFT",
        },
        {
          label: "Queued",
          value: "QUEUED",
        },
        {
          label: "In Production",
          value: "IN_PRODUCTION",
        },
        {
          label: "Blocked",
          value: "BLOCKED",
        },
        {
          label: "Completed",
          value: "COMPLETED",
        },
        {
          label: "Ready for Pickup",
          value: "READY_FOR_PICKUP",
        },
      ]}
      size="small"
      value={job.status}
      variant={VARIANT_LUT[job.status]}
    />
  );
}
