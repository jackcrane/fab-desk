import { Button, Input } from "@jackcrane/ui";
import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";
import { Flex } from "../components/flex";

export function ShopBasicSettingsRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading } = useShopRoute({
    navigate,
    shopId,
  });

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
        <Flex gap={2}>
          <Input label="Shop Name" placeholder="Downtown Fab Shop" />
          <Input label="Organization" placeholder="Manufacturing Co" />
          <Input label="Primary Contact Email" placeholder="ops@example.com" />
          <Button type="button" variant="primary" disabled>
            Save
          </Button>
        </Flex>
      </main>
    </Page>
  );
}
