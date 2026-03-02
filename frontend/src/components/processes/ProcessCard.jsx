import { Button, Card } from "@jackcrane/ui";
import { Flex } from "../flex";
import { Table } from "../table";
import { dollar } from "../../lib/dollar";
import { NewResourceModal } from "./NewResourceModal";
import { NewMaterialModal } from "./NewMaterialModal";
import { useState } from "react";

export function ProcessCard({ shopId, process, canEdit }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Card
      collapsed={collapsed}
      onCollapseChange={(collapsed) => {
        setCollapsed(collapsed);
      }}
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
  );
}
