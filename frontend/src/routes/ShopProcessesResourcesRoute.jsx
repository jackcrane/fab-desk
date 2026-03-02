import { useState } from "react";
import { Button, Card, Hatch, Input, useModal } from "@jackcrane/ui";
import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";
import { Flex } from "../components/flex";
import { Table } from "../components/table";
import { dollar } from "../lib/dollar";
import {
  useCreateShopProcessMaterialMutation,
  useCreateShopProcessMutation,
  useCreateShopProcessResourceMutation,
  useShopProcessCatalogQuery,
} from "../lib/shops-orpc";

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
  const [resourceProcess, setResourceProcess] = useState(null);
  const [newResourceName, setNewResourceName] = useState("");
  const [newResourceDescription, setNewResourceDescription] = useState("");
  const [newResourceUnit, setNewResourceUnit] = useState("");
  const [newResourceCostPerUnit, setNewResourceCostPerUnit] = useState("0");
  const [newResourceFlatCost, setNewResourceFlatCost] = useState("0");
  const [createResourceError, setCreateResourceError] = useState("");
  const [materialProcess, setMaterialProcess] = useState(null);
  const [newMaterialName, setNewMaterialName] = useState("");
  const [newMaterialDescription, setNewMaterialDescription] = useState("");
  const [newMaterialUnit, setNewMaterialUnit] = useState("");
  const [newMaterialCostPerUnit, setNewMaterialCostPerUnit] = useState("0");
  const [newMaterialFlatCost, setNewMaterialFlatCost] = useState("0");
  const [createMaterialError, setCreateMaterialError] = useState("");
  const { trigger: createShopProcess, isMutating: isCreatingProcess } =
    useCreateShopProcessMutation({
      shopId: pageShopId,
    });
  const { trigger: createShopProcessResource, isMutating: isCreatingResource } =
    useCreateShopProcessResourceMutation({
      shopId: pageShopId,
    });
  const { trigger: createShopProcessMaterial, isMutating: isCreatingMaterial } =
    useCreateShopProcessMaterialMutation({
      shopId: pageShopId,
    });
  const canEdit = activeShop?.role === "ADMIN";
  const processes = processCatalog?.processes ?? [];
  const pageLoading =
    isLoading ||
    !activeShop ||
    (!!activeShop && isLoadingProcessCatalog && !processCatalog);

  if (!isPending && !session) {
    return null;
  }

  const resetCreateProcessForm = () => {
    setNewProcessName("");
    setNewProcessDescription("");
    setCreateProcessError("");
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
      await createShopProcess({
        shopId: activeShop.id,
        name,
        description: description || undefined,
      });

      resetCreateProcessForm();
      setOpen(false);
    } catch (error) {
      setCreateProcessError(error?.message ?? "Unable to create process.");
    }
  };

  const resetCreateResourceForm = () => {
    setResourceProcess(null);
    setNewResourceName("");
    setNewResourceDescription("");
    setNewResourceUnit("");
    setNewResourceCostPerUnit("0");
    setNewResourceFlatCost("0");
    setCreateResourceError("");
  };

  const parseNonNegativeNumberInput = (rawValue, label) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      throw new Error(`${label} is required.`);
    }

    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error(`${label} must be a number greater than or equal to 0.`);
    }

    return numericValue;
  };

  const onCreateResource = async () => {
    setCreateResourceError("");

    if (!activeShop) {
      return;
    }

    if (!canEdit) {
      setCreateResourceError("Only shop admins can create resources.");
      return;
    }

    const processId = resourceProcess?.id ?? "";
    if (!processId) {
      setCreateResourceError("Select a process before creating a resource.");
      return;
    }

    const name = newResourceName.trim();
    const description = newResourceDescription.trim();
    const unit = newResourceUnit.trim();

    if (!name) {
      setCreateResourceError("Resource name is required.");
      return;
    }

    if (!unit) {
      setCreateResourceError("Unit is required.");
      return;
    }

    let costPerUnit;
    let flatCost;
    try {
      costPerUnit = parseNonNegativeNumberInput(
        newResourceCostPerUnit,
        "Cost per unit",
      );
      flatCost = parseNonNegativeNumberInput(newResourceFlatCost, "Flat cost");
    } catch (error) {
      setCreateResourceError(error?.message ?? "Invalid cost values.");
      return;
    }

    try {
      await createShopProcessResource({
        shopId: activeShop.id,
        processId,
        name,
        description: description || undefined,
        unit,
        costPerUnit,
        flatCost,
      });

      resetCreateResourceForm();
      setResourceModalOpen(false);
    } catch (error) {
      setCreateResourceError(error?.message ?? "Unable to create resource.");
    }
  };

  const resetCreateMaterialForm = () => {
    setMaterialProcess(null);
    setNewMaterialName("");
    setNewMaterialDescription("");
    setNewMaterialUnit("");
    setNewMaterialCostPerUnit("0");
    setNewMaterialFlatCost("0");
    setCreateMaterialError("");
  };

  const onCreateMaterial = async () => {
    setCreateMaterialError("");

    if (!activeShop) {
      return;
    }

    if (!canEdit) {
      setCreateMaterialError("Only shop admins can create materials.");
      return;
    }

    const processId = materialProcess?.id ?? "";
    if (!processId) {
      setCreateMaterialError("Select a process before creating a material.");
      return;
    }

    const name = newMaterialName.trim();
    const description = newMaterialDescription.trim();
    const unit = newMaterialUnit.trim();

    if (!name) {
      setCreateMaterialError("Material name is required.");
      return;
    }

    if (!unit) {
      setCreateMaterialError("Unit is required.");
      return;
    }

    let costPerUnit;
    let flatCost;
    try {
      costPerUnit = parseNonNegativeNumberInput(
        newMaterialCostPerUnit,
        "Cost per unit",
      );
      flatCost = parseNonNegativeNumberInput(newMaterialFlatCost, "Flat cost");
    } catch (error) {
      setCreateMaterialError(error?.message ?? "Invalid cost values.");
      return;
    }

    try {
      await createShopProcessMaterial({
        shopId: activeShop.id,
        processId,
        name,
        description: description || undefined,
        unit,
        costPerUnit,
        flatCost,
      });

      resetCreateMaterialForm();
      setMaterialModalOpen(false);
    } catch (error) {
      setCreateMaterialError(error?.message ?? "Unable to create material.");
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
  const { Modal: ResourceModal, setOpen: setResourceModalOpen } = useModal({
    title: "New Resource",
    content: (
      <form
        onSubmitCapture={(event) => {
          event.preventDefault();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void onCreateResource();
        }}
      >
        <Flex gap={2}>
          <Input
            type="text"
            value={newResourceName}
            onChange={(event) => {
              setNewResourceName(event.target.value);
              setCreateResourceError("");
            }}
            required
            label="Resource name"
            placeholder="Bambu Lab P1S"
            disabled={!canEdit || isCreatingResource}
          />
          <Input
            type="text"
            value={newResourceDescription}
            onChange={(event) => {
              setNewResourceDescription(event.target.value);
              setCreateResourceError("");
            }}
            label="Description (optional)"
            placeholder="High-speed FDM printer."
            disabled={!canEdit || isCreatingResource}
          />
          <Input
            type="text"
            value={newResourceUnit}
            onChange={(event) => {
              setNewResourceUnit(event.target.value);
              setCreateResourceError("");
            }}
            required
            label="Unit"
            placeholder="hour"
            disabled={!canEdit || isCreatingResource}
          />
          <Input
            type="number"
            value={newResourceCostPerUnit}
            onChange={(event) => {
              setNewResourceCostPerUnit(event.target.value);
              setCreateResourceError("");
            }}
            required
            label="Cost per unit"
            placeholder="0"
            min="0"
            step="0.01"
            disabled={!canEdit || isCreatingResource}
          />
          <Input
            type="number"
            value={newResourceFlatCost}
            onChange={(event) => {
              setNewResourceFlatCost(event.target.value);
              setCreateResourceError("");
            }}
            required
            label="Flat cost"
            placeholder="0"
            min="0"
            step="0.01"
            disabled={!canEdit || isCreatingResource}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!canEdit || isCreatingResource}
            loading={isCreatingResource}
          >
            {isCreatingResource ? "Creating..." : "Create resource"}
          </Button>
          {!canEdit ? (
            <Hatch variant="warning" footerHeight={12}>
              Only shop admins can create resources.
            </Hatch>
          ) : null}
          {createResourceError ? (
            <Hatch variant="danger" footerHeight={12}>
              {createResourceError}
            </Hatch>
          ) : null}
        </Flex>
      </form>
    ),
  });
  const { Modal: MaterialModal, setOpen: setMaterialModalOpen } = useModal({
    title: "New Material",
    content: (
      <form
        onSubmitCapture={(event) => {
          event.preventDefault();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void onCreateMaterial();
        }}
      >
        <Flex gap={2}>
          <Input
            type="text"
            value={newMaterialName}
            onChange={(event) => {
              setNewMaterialName(event.target.value);
              setCreateMaterialError("");
            }}
            required
            label="Material name"
            placeholder="PLA"
            disabled={!canEdit || isCreatingMaterial}
          />
          <Input
            type="text"
            value={newMaterialDescription}
            onChange={(event) => {
              setNewMaterialDescription(event.target.value);
              setCreateMaterialError("");
            }}
            label="Description (optional)"
            placeholder="Standard PLA filament."
            disabled={!canEdit || isCreatingMaterial}
          />
          <Input
            type="text"
            value={newMaterialUnit}
            onChange={(event) => {
              setNewMaterialUnit(event.target.value);
              setCreateMaterialError("");
            }}
            required
            label="Unit"
            placeholder="gram"
            disabled={!canEdit || isCreatingMaterial}
          />
          <Input
            type="number"
            value={newMaterialCostPerUnit}
            onChange={(event) => {
              setNewMaterialCostPerUnit(event.target.value);
              setCreateMaterialError("");
            }}
            required
            label="Cost per unit"
            placeholder="0"
            min="0"
            step="0.01"
            disabled={!canEdit || isCreatingMaterial}
          />
          <Input
            type="number"
            value={newMaterialFlatCost}
            onChange={(event) => {
              setNewMaterialFlatCost(event.target.value);
              setCreateMaterialError("");
            }}
            required
            label="Flat cost"
            placeholder="0"
            min="0"
            step="0.01"
            disabled={!canEdit || isCreatingMaterial}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!canEdit || isCreatingMaterial}
            loading={isCreatingMaterial}
          >
            {isCreatingMaterial ? "Creating..." : "Create material"}
          </Button>
          {!canEdit ? (
            <Hatch variant="warning" footerHeight={12}>
              Only shop admins can create materials.
            </Hatch>
          ) : null}
          {createMaterialError ? (
            <Hatch variant="danger" footerHeight={12}>
              {createMaterialError}
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
      <ResourceModal />
      <MaterialModal />
      {activeShop ? (
        <main>
          <p style={{ marginBottom: 16 }}>
            Set up processes and resources for your shop. Think of processes as
            a high-level category of work, such as "FDM 3D Printing", "CNC
            Machining", or "Labor"
          </p>

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
                onClick={() => {
                  resetCreateProcessForm();
                  setOpen(true);
                }}
                disabled={!canEdit}
              >
                Create a new process
              </Button>
            </div>
          ) : null}

          <Flex direction="column" gap={2}>
            {processes.map((process) => (
              <Card
                key={process.id}
                title={process.name}
                footer={
                  <Flex direction="row" gap={2}>
                    <Button
                      onClick={() => {
                        resetCreateResourceForm();
                        setResourceProcess({
                          id: process.id,
                          name: process.name,
                        });
                        setResourceModalOpen(true);
                      }}
                      disabled={!canEdit}
                    >
                      Create a new resource
                    </Button>
                    <Button
                      onClick={() => {
                        resetCreateMaterialForm();
                        setMaterialProcess({
                          id: process.id,
                          name: process.name,
                        });
                        setMaterialModalOpen(true);
                      }}
                      disabled={!canEdit}
                    >
                      Create a new material
                    </Button>
                  </Flex>
                }
                footerHeight={40}
              >
                <p>{process.description || "No description provided."}</p>
                <h3>Resources</h3>
                {process.resources.length > 0 ? (
                  <div
                    style={{
                      marginLeft: 16,
                      width: "calc(100% - 16px)",
                    }}
                  >
                    <Table
                      style={{
                        marginTop: 0,
                      }}
                      columns={[
                        {
                          header: "Name",
                          render: (resource) => resource.name,
                        },
                        {
                          header: "Cost",
                          render: (resource) =>
                            `${dollar(resource.costPerUnit)} per ${resource.unit} plus ${dollar(resource.flatCost)}`,
                        },
                        {
                          header: "Edit",
                          render: (resource) => (
                            <Button
                              type="button"
                              onClick={() => {
                                console.log(resource);
                              }}
                              size="small"
                            >
                              Edit
                            </Button>
                          ),
                        },
                      ]}
                      rows={process.resources}
                    />
                  </div>
                ) : (
                  <p
                    style={{
                      color: "var(--secondary-color-500)",
                    }}
                  >
                    No resources are configured for this process.
                  </p>
                )}
                <h3 style={{ marginTop: 16 }}>Materials</h3>
                {process.materials.length > 0 ? (
                  <Table
                    style={{
                      marginTop: 0,
                      marginLeft: 16,
                      width: "calc(100% - 16px)",
                    }}
                    columns={[
                      {
                        header: "Name",
                        render: (material) => material.name,
                      },
                      {
                        header: "Cost",
                        render: (material) =>
                          `${dollar(material.costPerUnit)} per ${material.unit} plus ${dollar(material.flatCost)}`,
                      },
                      {
                        header: "Edit",
                        render: (material) => (
                          <Button
                            type="button"
                            onClick={() => {
                              console.log(material);
                            }}
                            size="small"
                          >
                            Edit
                          </Button>
                        ),
                      },
                    ]}
                    rows={process.materials}
                  />
                ) : (
                  <p
                    style={{
                      color: "var(--secondary-color-500)",
                    }}
                  >
                    No materials are configured for this process.
                  </p>
                )}
              </Card>
            ))}
          </Flex>
        </main>
      ) : null}
    </Page>
  );
}
