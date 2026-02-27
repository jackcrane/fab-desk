import { useMemo, useState } from "react";
import { Page, sidenavItems } from "../../components/page";
import { useShopRoute } from "../useShopRoute";
import { Hatch, SegmentedControl, Select } from "@jackcrane/ui";
import {
  useShopJobsQuery,
  useUpdateJobStatusMutation,
} from "../../lib/jobs-orpc";
import styles from "./shop.module.css";

const STATUS_OPTIONS = [
  { label: "Draft", value: "DRAFT" },
  { label: "Queued", value: "QUEUED" },
  { label: "In Production", value: "IN_PRODUCTION" },
  { label: "Blocked", value: "BLOCKED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Ready for Pickup", value: "READY_FOR_PICKUP" },
];

const STATUS_LABELS = {
  DRAFT: "Draft",
  QUEUED: "Queued",
  IN_PRODUCTION: "In Production",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  READY_FOR_PICKUP: "Ready for Pickup",
};

const STATUS_VARIANT_LUT = {
  DRAFT: "secondary",
  QUEUED: "warning",
  IN_PRODUCTION: "primary",
  BLOCKED: "danger",
  COMPLETED: "info",
  READY_FOR_PICKUP: "success",
};

const PRIORITY_LABELS = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function formatPriorityLabel(priority) {
  return PRIORITY_LABELS[priority] ?? priority;
}

function formatPriorityTone(priority) {
  if (priority === "HIGH") {
    return "var(--danger-color-500)";
  }

  if (priority === "MEDIUM") {
    return "var(--warning-color-500)";
  }

  return "var(--success-color-500)";
}

function formatPrioritySymbol(priority) {
  if (priority === "HIGH") {
    return "!!!";
  }

  if (priority === "MEDIUM") {
    return "!!";
  }

  return "!";
}

export function ShopJobsRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading } = useShopRoute({
    navigate,
    shopId,
  });
  const [viewMode, setViewMode] = useState("list");
  const [updatingJobId, setUpdatingJobId] = useState("");
  const pageShopId = activeShop?.id ?? shopId;
  const {
    data: jobsData,
    error: jobsError,
    isLoading: isLoadingJobs,
  } = useShopJobsQuery({
    shopId: pageShopId,
    enabled: !!activeShop,
  });
  const { trigger: updateJobStatus, isMutating: isUpdatingJobStatus } =
    useUpdateJobStatusMutation({
      shopId: pageShopId,
    });
  const jobs = jobsData?.jobs ?? [];
  const pageLoading =
    isLoading || !activeShop || (!!activeShop && isLoadingJobs && !jobsData);

  if (!isPending && !session) {
    return null;
  }

  const onUpdateJobStatus = async (jobId, status) => {
    if (!activeShop || !jobId || !status) {
      return;
    }

    setUpdatingJobId(jobId);
    try {
      await updateJobStatus({
        shopId: activeShop.id,
        jobId,
        status,
      });
    } finally {
      setUpdatingJobId("");
    }
  };

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
          value={viewMode}
          onValueChange={setViewMode}
        />

        {jobsError ? (
          <Hatch variant="danger" style={{ marginTop: 16 }}>
            Unable to load jobs right now:{" "}
            {jobsError.message ?? "Unknown error"}
          </Hatch>
        ) : null}

        {viewMode !== "list" ? (
          <p className={styles.info}>
            Only list view is wired to backend right now.
          </p>
        ) : (
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
              {jobs.length === 0 ? (
                <tr className={styles.job}>
                  <td colSpan={6} className={styles.empty}>
                    No jobs in this shop yet.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className={styles.job}>
                    <td>
                      <JobStatusPicker
                        job={job}
                        isUpdating={
                          isUpdatingJobStatus && updatingJobId === job.id
                        }
                        onStatusChange={onUpdateJobStatus}
                      />
                    </td>
                    <td>{job.name}</td>
                    <td>{job.customer}</td>
                    <td>
                      <div
                        style={{
                          color: formatPriorityTone(job.priority),
                          width: 12,
                          display: "inline-block",
                          textAlign: "right",
                        }}
                      >
                        {formatPrioritySymbol(job.priority)}
                      </div>{" "}
                      {formatPriorityLabel(job.priority)}
                    </td>
                    <td>{new Date(job.dueDate).toLocaleDateString()}</td>
                    <td>{job.assignee}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </main>
    </Page>
  );
}

function JobStatusPicker({ job, onStatusChange, isUpdating }) {
  const normalizedStatus = useMemo(() => {
    if (!job?.status) {
      return "DRAFT";
    }

    return STATUS_LABELS[job.status] ? job.status : "DRAFT";
  }, [job]);

  return (
    <Select
      options={STATUS_OPTIONS}
      size="small"
      value={normalizedStatus}
      variant={STATUS_VARIANT_LUT[normalizedStatus]}
      loading={isUpdating}
      onValueChange={(nextStatus) => {
        if (nextStatus !== normalizedStatus) {
          void onStatusChange(job.id, nextStatus);
        }
      }}
    />
  );
}
