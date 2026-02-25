import { useEffect, useMemo, useState } from "react";
import { Button, Hatch, Input } from "@jackcrane/ui";
import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";
import { Flex } from "../components/flex";
import { updateShopBasicSettings } from "../lib/shop-api";

export function ShopBasicSettingsRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading } = useShopRoute({
    navigate,
    shopId,
  });
  const [shopName, setShopName] = useState("");
  const [organization, setOrganization] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [initialValues, setInitialValues] = useState({
    name: "",
    organization: "",
    primaryContactEmail: "",
  });
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activeShop) {
      return;
    }

    const nextValues = {
      name: activeShop.name ?? "",
      organization: activeShop.organization ?? "",
      primaryContactEmail: activeShop.primaryContactEmail ?? "",
    };

    setInitialValues(nextValues);
    setShopName(nextValues.name);
    setOrganization(nextValues.organization);
    setPrimaryContactEmail(nextValues.primaryContactEmail);
    setSaveError("");
    setSaveSuccess("");
  }, [activeShop]);

  const normalizedValues = useMemo(
    () => ({
      name: shopName.trim(),
      organization: organization.trim(),
      primaryContactEmail: primaryContactEmail.trim(),
    }),
    [organization, primaryContactEmail, shopName],
  );

  const canEdit = activeShop?.role === "ADMIN";
  const hasChanges =
    normalizedValues.name !== initialValues.name ||
    normalizedValues.organization !== initialValues.organization ||
    normalizedValues.primaryContactEmail !== initialValues.primaryContactEmail;
  const hasValidationError =
    normalizedValues.name.length === 0 ||
    normalizedValues.organization.length === 0;

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaveError("");
    setSaveSuccess("");

    if (!activeShop) {
      return;
    }

    if (!canEdit) {
      setSaveError("Only shop admins can edit basic settings.");
      return;
    }

    if (hasValidationError) {
      setSaveError("Shop name and organization are required.");
      return;
    }

    if (!hasChanges) {
      return;
    }

    setIsSaving(true);

    try {
      const updatedShop = await updateShopBasicSettings(
        activeShop.id,
        normalizedValues,
      );
      const nextValues = {
        name: updatedShop.name ?? "",
        organization: updatedShop.organization ?? "",
        primaryContactEmail: updatedShop.primaryContactEmail ?? "",
      };

      setInitialValues(nextValues);
      setShopName(nextValues.name);
      setOrganization(nextValues.organization);
      setPrimaryContactEmail(nextValues.primaryContactEmail);
      setSaveSuccess("Basic settings saved.");
    } catch (error) {
      setSaveError(error?.message ?? "Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isPending && !session) {
    return null;
  }

  if (!activeShop) {
    return null;
  }

  return (
    <Page
      title="Basic Settings"
      shopId={activeShop.id}
      loading={isLoading}
      sidenavItems={sidenavItems({
        activePage: "settings",
        shopId: activeShop.id,
      })}
      breadcrumbs={[
        {
          label: "Shops",
          href: "/shop",
        },
        {
          label: activeShop.name,
          href: "/shop/" + activeShop.id,
        },
        {
          label: "Shop Settings",
          href: "/shop/" + activeShop.id + "/settings",
        },
        {
          label: "Basic Settings",
          href: "/shop/" + activeShop.id + "/settings/basic",
        },
      ]}
    >
      <main style={{ maxWidth: 500 }}>
        <h3>Shop Branding Settings</h3>
        <p style={{ marginBottom: 16 }}>
          Configure your shop's basic branding settings.
        </p>
        <form onSubmit={onSubmit}>
          <Flex gap={2}>
            <Input
              label="Shop Name"
              placeholder="Downtown Fab Shop"
              value={shopName}
              onChange={(event) => {
                setShopName(event.target.value);
                setSaveError("");
                setSaveSuccess("");
              }}
              required
              disabled={!canEdit || isSaving}
            />
            <Input
              label="Organization"
              placeholder="Manufacturing Co"
              value={organization}
              onChange={(event) => {
                setOrganization(event.target.value);
                setSaveError("");
                setSaveSuccess("");
              }}
              required
              disabled={!canEdit || isSaving}
            />
            <Input
              label="Primary Contact Email"
              placeholder="ops@example.com"
              type="email"
              value={primaryContactEmail}
              onChange={(event) => {
                setPrimaryContactEmail(event.target.value);
                setSaveError("");
                setSaveSuccess("");
              }}
              disabled={!canEdit || isSaving}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={
                !canEdit || isSaving || hasValidationError || !hasChanges
              }
              loading={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
            {!canEdit ? (
              <Hatch variant="warning" footerHeight={12}>
                Only shop admins can edit basic settings.
              </Hatch>
            ) : null}
            {saveError ? (
              <Hatch variant="danger" footerHeight={12}>
                {saveError}
              </Hatch>
            ) : null}
            {saveSuccess ? (
              <Hatch variant="success" footerHeight={12}>
                {saveSuccess}
              </Hatch>
            ) : null}
          </Flex>
        </form>
      </main>
    </Page>
  );
}
