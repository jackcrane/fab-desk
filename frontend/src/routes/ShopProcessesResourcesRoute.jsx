import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Hatch, Input, useModal } from "@jackcrane/ui";
import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";
import { Flex } from "../components/flex";
import {
  useCreateShopProcessMutation,
  useShopProcessCatalogQuery,
} from "../lib/shops-orpc";
import { ProcessCard } from "../components/processes/ProcessCard";

export function ShopProcessesResourcesRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading } = useShopRoute({
    navigate,
    shopId,
  });
  const pageShopId = activeShop?.id ?? shopId;
  const {
    data: processCatalog,
    error: processCatalogError,
    isLoading: isLoadingProcessCatalog,
  } = useShopProcessCatalogQuery({
    shopId: pageShopId,
    enabled: !!activeShop,
    shouldRetryOnError: false,
  });
  const [newProcessName, setNewProcessName] = useState("");
  const [newProcessDescription, setNewProcessDescription] = useState("");
  const [createProcessError, setCreateProcessError] = useState("");
  const [collapsedByProcessId, setCollapsedByProcessId] = useState({});
  const [newestProcessId, setNewestProcessId] = useState(null);
  const [highlightedProcessId, setHighlightedProcessId] = useState(null);
  const [pendingCreatedProcess, setPendingCreatedProcess] = useState(false);
  const previousProcessIdsRef = useRef([]);
  const { trigger: createShopProcess, isMutating: isCreatingProcess } =
    useCreateShopProcessMutation({
      shopId: pageShopId,
    });

  const canEdit = activeShop?.role === "ADMIN";
  const processes = processCatalog?.processes ?? [];
  const orderedProcesses = useMemo(() => {
    if (!newestProcessId) {
      return processes;
    }

    const newestProcess = processes.find(
      (process) => process.id === newestProcessId,
    );
    if (!newestProcess) {
      return processes;
    }

    return [
      newestProcess,
      ...processes.filter((process) => process.id !== newestProcessId),
    ];
  }, [newestProcessId, processes]);
  const pageLoading =
    isLoading ||
    !activeShop ||
    (!!activeShop && isLoadingProcessCatalog && !processCatalog);

  useEffect(() => {
    if (!highlightedProcessId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedProcessId((currentId) =>
        currentId === highlightedProcessId ? null : currentId,
      );
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedProcessId]);

  useEffect(() => {
    const previousProcessIds = previousProcessIdsRef.current;
    const currentProcessIds = processes.map((process) => process.id);

    if (pendingCreatedProcess) {
      const previousIdSet = new Set(previousProcessIds);
      const addedProcessIds = currentProcessIds.filter(
        (processId) => !previousIdSet.has(processId),
      );

      if (addedProcessIds.length > 0) {
        const newestDetectedProcessId = addedProcessIds[addedProcessIds.length - 1];
        setNewestProcessId(newestDetectedProcessId);
        setHighlightedProcessId(newestDetectedProcessId);
        setCollapsedByProcessId((currentState) => ({
          ...currentState,
          [newestDetectedProcessId]: false,
        }));
        setPendingCreatedProcess(false);
      }
    }

    previousProcessIdsRef.current = currentProcessIds;
  }, [pendingCreatedProcess, processes]);

  if (!isPending && !session) {
    return null;
  }

  const resetCreateProcessForm = () => {
    setNewProcessName("");
    setNewProcessDescription("");
    setCreateProcessError("");
  };

  const openCreateProcessModal = () => {
    resetCreateProcessForm();
    setOpen(true);
  };

  const onCreateProcess = async () => {
    setCreateProcessError("");

    if (!activeShop) {
      return;
    }

    if (!canEdit) {
      setCreateProcessError("Only shop admins can create new processes.");
      return;
    }

    const name = newProcessName.trim();
    const description = newProcessDescription.trim();

    if (!name) {
      setCreateProcessError("Process name is required.");
      return;
    }

    try {
      setPendingCreatedProcess(true);
      const createdProcess = await createShopProcess({
        shopId: activeShop.id,
        name,
        description: description || undefined,
      });
      const createdProcessId = createdProcess?.id;

      if (createdProcessId) {
        setNewestProcessId(createdProcessId);
        setHighlightedProcessId(createdProcessId);
        setCollapsedByProcessId((currentState) => ({
          ...currentState,
          [createdProcessId]: false,
        }));
        setPendingCreatedProcess(false);
      }

      resetCreateProcessForm();
      setOpen(false);
    } catch (error) {
      setPendingCreatedProcess(false);
      setCreateProcessError(error?.message ?? "Unable to create process.");
    }
  };

  const { Modal, setOpen } = useModal({
    title: "Create a new process",
    content: (
      <form
        onSubmitCapture={(event) => {
          event.preventDefault();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void onCreateProcess();
        }}
      >
        <Flex gap={2}>
          <Input
            type="text"
            value={newProcessName}
            onChange={(event) => {
              setNewProcessName(event.target.value);
              setCreateProcessError("");
            }}
            required
            label="Process name"
            placeholder="3D Printing"
            disabled={!canEdit || isCreatingProcess}
          />
          <Input
            type="text"
            value={newProcessDescription}
            onChange={(event) => {
              setNewProcessDescription(event.target.value);
              setCreateProcessError("");
            }}
            label="Description (optional)"
            placeholder="Print 3D models."
            disabled={!canEdit || isCreatingProcess}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!canEdit || isCreatingProcess}
            loading={isCreatingProcess}
          >
            {isCreatingProcess ? "Creating..." : "Create process"}
          </Button>
          {!canEdit ? (
            <Hatch variant="warning" footerHeight={12}>
              Only shop admins can create processes.
            </Hatch>
          ) : null}
          {createProcessError ? (
            <Hatch variant="danger" footerHeight={12}>
              {createProcessError}
            </Hatch>
          ) : null}
        </Flex>
      </form>
    ),
  });

  return (
    <Page
      title="Processes & Resources"
      shopId={pageShopId}
      loading={pageLoading}
      sidenavItems={sidenavItems({
        activePage: "processesResources",
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
                label: "Processes & Resources",
                href: "/shop/" + activeShop.id + "/processes-resources",
              },
            ]
          : []
      }
    >
      <Modal />
      {activeShop ? (
        <main>
          <p style={{ marginBottom: 16 }}>
            Set up processes and resources for your shop. Think of processes as
            a high-level category of work, such as "FDM 3D Printing", "CNC
            Machining", or "Labor"
          </p>
          <Button
            onClick={openCreateProcessModal}
            disabled={!canEdit}
          >
            Create a new process
          </Button>

          <hr />

          {processCatalogError ? (
            <Hatch variant="danger" footerHeight={12}>
              Unable to load process catalog:{" "}
              {processCatalogError.message ?? "Unknown error"}
            </Hatch>
          ) : null}

          {!processCatalogError && !pageLoading && processes.length === 0 ? (
            <div
              style={{
                width: "100%",
                height: 300,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <p style={{ color: "var(--secondary-color-500)" }}>
                No processes are configured for this shop yet.
              </p>
              <Button
                variant="primary"
                onClick={openCreateProcessModal}
                disabled={!canEdit}
              >
                Create a new process
              </Button>
            </div>
          ) : null}

          <Flex direction="column" gap={2}>
            {orderedProcesses.map((process) => (
              <ProcessCard
                key={process.id}
                shopId={activeShop.id}
                process={process}
                canEdit={canEdit}
                collapsed={
                  process.id in collapsedByProcessId
                    ? collapsedByProcessId[process.id]
                    : orderedProcesses.length === 1
                      ? false
                      : true
                }
                onCollapseChange={(nextCollapsedState) => {
                  setCollapsedByProcessId((currentState) => ({
                    ...currentState,
                    [process.id]: nextCollapsedState,
                  }));
                }}
                variant={
                  highlightedProcessId === process.id ? "primary" : undefined
                }
              />
            ))}
          </Flex>
        </main>
      ) : null}
    </Page>
  );
}
