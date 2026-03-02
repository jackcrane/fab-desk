import { useState } from "react";
import { Button, Card, Dropdown, Hatch, Input, useModal } from "@jackcrane/ui";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { Flex } from "../flex";
import { Table } from "../table";
import { dollar } from "../../lib/dollar";
import { NewResourceModal } from "./NewResourceModal";
import { NewMaterialModal } from "./NewMaterialModal";
import {
  useDeleteShopProcessMutation,
  useUpdateShopProcessMutation,
} from "../../lib/shops-orpc";

export function ProcessCard({
  shopId,
  process,
  canEdit,
  collapsed,
  onCollapseChange,
  variant,
}) {
  const [editName, setEditName] = useState(process.name ?? "");
  const [editDescription, setEditDescription] = useState(
    process.description ?? "",
  );
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const { trigger: updateShopProcess, isMutating: isUpdatingProcess } =
    useUpdateShopProcessMutation({
      shopId,
    });
  const { trigger: deleteShopProcess, isMutating: isDeletingProcess } =
    useDeleteShopProcessMutation({
      shopId,
    });

  const resetEditState = () => {
    setEditName(process.name ?? "");
    setEditDescription(process.description ?? "");
    setEditError("");
  };

  const onEditProcess = async () => {
    setEditError("");

    if (!canEdit) {
      setEditError("Only shop admins can edit processes.");
      return;
    }

    const name = editName.trim();
    const description = editDescription.trim();
    if (!name) {
      setEditError("Process name is required.");
      return;
    }

    try {
      await updateShopProcess({
        shopId,
        processId: process.id,
        name,
        description: description || undefined,
      });

      setEditProcessModalOpen(false);
    } catch (error) {
      setEditError(error?.message ?? "Unable to update process.");
    }
  };

  const onDeleteProcess = async () => {
    setDeleteError("");

    if (!canEdit) {
      setDeleteError("Only shop admins can delete processes.");
      return;
    }

    try {
      await deleteShopProcess({
        shopId,
        processId: process.id,
      });

      setDeleteProcessModalOpen(false);
    } catch (error) {
      setDeleteError(error?.message ?? "Unable to delete process.");
    }
  };

  const { Modal: EditProcessModal, setOpen: setEditProcessModalOpen } =
    useModal({
      title: "Edit process",
      content: (
        <form
          onSubmitCapture={(event) => {
            event.preventDefault();
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void onEditProcess();
          }}
        >
          <Flex gap={2}>
            <Input
              type="text"
              value={editName}
              onChange={(event) => {
                setEditName(event.target.value);
                setEditError("");
              }}
              required
              label="Process name"
              disabled={!canEdit || isUpdatingProcess}
            />
            <Input
              type="text"
              value={editDescription}
              onChange={(event) => {
                setEditDescription(event.target.value);
                setEditError("");
              }}
              label="Description (optional)"
              disabled={!canEdit || isUpdatingProcess}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!canEdit || isUpdatingProcess}
              loading={isUpdatingProcess}
            >
              {isUpdatingProcess ? "Saving..." : "Save process"}
            </Button>
            {editError ? (
              <Hatch variant="danger" footerHeight={12}>
                {editError}
              </Hatch>
            ) : null}
          </Flex>
        </form>
      ),
    });

  const { Modal: DeleteProcessModal, setOpen: setDeleteProcessModalOpen } =
    useModal({
      title: "Delete process",
      content: (
        <form
          onSubmitCapture={(event) => {
            event.preventDefault();
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void onDeleteProcess();
          }}
        >
          <Flex gap={2}>
            <p>
              Delete <strong>{process.name}</strong>? This removes its materials
              and resources.
            </p>
            <Button
              type="submit"
              variant="danger"
              disabled={!canEdit || isDeletingProcess}
              loading={isDeletingProcess}
            >
              {isDeletingProcess ? "Deleting..." : "Delete process"}
            </Button>
            {deleteError ? (
              <Hatch variant="danger" footerHeight={12}>
                {deleteError}
              </Hatch>
            ) : null}
          </Flex>
        </form>
      ),
    });

  return (
    <>
      <EditProcessModal />
      <DeleteProcessModal />
      <Card
        variant={variant}
        collapsed={collapsed}
        onCollapseChange={onCollapseChange}
        title={process.name}
        footer={
          <Flex direction="row" gap={2}>
            <NewResourceModal
              shopId={shopId}
              processId={process.id}
              canEdit={canEdit}
            />
            <NewMaterialModal
              shopId={shopId}
              processId={process.id}
              canEdit={canEdit}
            />
            <div style={{ flex: 1 }} />
            <Dropdown
              triggerLabel="Actions"
              disabled={!canEdit}
              items={[
                {
                  label: "Edit process",
                  value: "edit-process",
                  icon: <IconEdit size={16} strokeWidth={1.75} />,
                },
                {
                  label: "Delete process",
                  value: "delete-process",
                  icon: <IconTrash size={16} strokeWidth={1.75} />,
                },
              ]}
              onItemSelect={(value) => {
                if (value === "edit-process") {
                  resetEditState();
                  setEditProcessModalOpen(true);
                  return;
                }

                if (value === "delete-process") {
                  setDeleteError("");
                  setDeleteProcessModalOpen(true);
                }
              }}
            />
          </Flex>
        }
        footerHeight={40}
      >
        <p>{process.description || "No description provided."}</p>
        <hr />
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
    </>
  );
}
