import { useEffect, useState } from "react";
import { Button, Hatch, Radio, RadioGroup } from "@jackcrane/ui";
import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";
import { Flex } from "../components/flex";
import { useUpdateShopAccessSettingsMutation } from "../lib/shops-orpc";

export function ShopAccessSettingsRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading } = useShopRoute({
    navigate,
    shopId,
  });
  const [membershipPolicy, setMembershipPolicy] = useState("invite-only");
  const [initialPolicy, setInitialPolicy] = useState("invite-only");
  const { trigger: updateShopAccessSettings, isMutating: isSaving } =
    useUpdateShopAccessSettingsMutation();
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [hydratedShopId, setHydratedShopId] = useState(null);

  useEffect(() => {
    if (!activeShop) {
      return;
    }

    if (hydratedShopId === activeShop.id) {
      return;
    }

    const nextPolicy = activeShop.membershipPolicy ?? "invite-only";

    setInitialPolicy(nextPolicy);
    setMembershipPolicy(nextPolicy);
    setSaveError("");
    setSaveSuccess("");
    setHydratedShopId(activeShop.id);
  }, [activeShop, hydratedShopId]);

  const canEdit = activeShop?.role === "ADMIN";
  const hasChanges = membershipPolicy !== initialPolicy;

  const onSubmit = async () => {
    setSaveError("");
    setSaveSuccess("");

    if (!activeShop) {
      return;
    }

    if (!canEdit) {
      setSaveError("Only shop admins can edit access policy.");
      return;
    }

    if (!hasChanges) {
      return;
    }

    try {
      const updatedShop = await updateShopAccessSettings({
        shopId: activeShop.id,
        membershipPolicy,
      });
      const nextPolicy = updatedShop.membershipPolicy ?? "invite-only";

      setInitialPolicy(nextPolicy);
      setMembershipPolicy(nextPolicy);
      setSaveSuccess("Access policy saved.");
    } catch (error) {
      setSaveError(error?.message ?? "Unable to save access policy.");
    }
  };

  if (!isPending && !session) {
    return null;
  }

  if (isLoading || !activeShop) {
    return (
      <Page
        title="Authentication & Access"
        shopId={shopId}
        loading
        sidenavItems={sidenavItems({
          activePage: "settings",
          shopId,
          showSettings: false,
        })}
      />
    );
  }

  const derivedDomain = activeShop.membershipEmailDomain || "";

  return (
    <Page
      title="Authentication & Access"
      shopId={activeShop.id}
      sidenavItems={sidenavItems({
        activePage: "settings",
        shopId: activeShop.id,
        showSettings: activeShop.role === "ADMIN",
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
          label: "Authentication & Access",
          href: "/shop/" + activeShop.id + "/settings/access",
        },
      ]}
    >
      <main style={{ maxWidth: 560 }}>
        <h3>Access Policy</h3>
        <p style={{ marginBottom: 16 }}>Choose who can join your shop.</p>
        <form
          onSubmitCapture={(event) => {
            event.preventDefault();
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          <Flex gap={2}>
            <div>
              <label
                style={{ display: "block", marginBottom: 8 }}
                id="membership-policy-label"
              >
                Who can join this shop?
              </label>
              <RadioGroup
                value={membershipPolicy}
                onValueChange={(nextValue) => {
                  setMembershipPolicy(nextValue);
                  setSaveError("");
                  setSaveSuccess("");
                }}
                aria-labelledby="membership-policy-label"
              >
                <Radio
                  value="invite-only"
                  label="Only people I invite"
                  variant="secondary"
                  disabled={!canEdit || isSaving}
                />
                <Radio
                  value="domain"
                  label={
                    derivedDomain
                      ? `Anyone with an email ending in @${derivedDomain}`
                      : "Anyone with an email ending in your domain"
                  }
                  variant="secondary"
                  disabled={!canEdit || isSaving}
                />
              </RadioGroup>
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!canEdit || isSaving || !hasChanges}
              loading={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
            {!canEdit ? (
              <Hatch variant="warning" footerHeight={12}>
                Only shop admins can edit access policy.
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
