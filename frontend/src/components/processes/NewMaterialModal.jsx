import { useState } from "react";
import { Button, Hatch, Input, useModal } from "@jackcrane/ui";
import { Flex } from "../flex";
import { useCreateShopProcessMaterialMutation } from "../../lib/shops-orpc";

function parseNonNegativeNumberInput(rawValue, label) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error(`${label} must be a number greater than or equal to 0.`);
  }

  return numericValue;
}

export function NewMaterialModal({ shopId, processId, canEdit }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("0");
  const [flatCost, setFlatCost] = useState("0");
  const [createError, setCreateError] = useState("");
  const { trigger: createShopProcessMaterial, isMutating: isCreatingMaterial } =
    useCreateShopProcessMaterialMutation({
      shopId,
    });

  const resetForm = () => {
    setName("");
    setDescription("");
    setUnit("");
    setCostPerUnit("0");
    setFlatCost("0");
    setCreateError("");
  };

  const onCreateMaterial = async () => {
    setCreateError("");

    if (!canEdit) {
      setCreateError("Only shop admins can create materials.");
      return;
    }

    const normalizedName = name.trim();
    const normalizedDescription = description.trim();
    const normalizedUnit = unit.trim();

    if (!normalizedName) {
      setCreateError("Material name is required.");
      return;
    }

    if (!normalizedUnit) {
      setCreateError("Unit is required.");
      return;
    }

    let parsedCostPerUnit;
    let parsedFlatCost;
    try {
      parsedCostPerUnit = parseNonNegativeNumberInput(
        costPerUnit,
        "Cost per unit",
      );
      parsedFlatCost = parseNonNegativeNumberInput(flatCost, "Flat cost");
    } catch (error) {
      setCreateError(error?.message ?? "Invalid cost values.");
      return;
    }

    try {
      await createShopProcessMaterial({
        shopId,
        processId,
        name: normalizedName,
        description: normalizedDescription || undefined,
        unit: normalizedUnit,
        costPerUnit: parsedCostPerUnit,
        flatCost: parsedFlatCost,
      });

      resetForm();
      setOpen(false);
    } catch (error) {
      setCreateError(error?.message ?? "Unable to create material.");
    }
  };

  const { Modal, setOpen } = useModal({
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
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setCreateError("");
            }}
            required
            label="Material name"
            placeholder="PLA"
            disabled={!canEdit || isCreatingMaterial}
          />
          <Input
            type="text"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setCreateError("");
            }}
            label="Description (optional)"
            placeholder="Standard PLA filament."
            disabled={!canEdit || isCreatingMaterial}
          />
          <Input
            type="text"
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value);
              setCreateError("");
            }}
            required
            label="Unit"
            placeholder="gram"
            disabled={!canEdit || isCreatingMaterial}
          />
          <Input
            type="number"
            value={costPerUnit}
            onChange={(event) => {
              setCostPerUnit(event.target.value);
              setCreateError("");
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
            value={flatCost}
            onChange={(event) => {
              setFlatCost(event.target.value);
              setCreateError("");
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
          {createError ? (
            <Hatch variant="danger" footerHeight={12}>
              {createError}
            </Hatch>
          ) : null}
        </Flex>
      </form>
    ),
  });

  return (
    <>
      <Modal />
      <Button
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        disabled={!canEdit}
      >
        Create a new material
      </Button>
    </>
  );
}
