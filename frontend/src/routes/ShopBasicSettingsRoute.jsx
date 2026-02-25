import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";

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
      <main>
        <h1>Basic Settings</h1>
        <p>This page is intentionally empty.</p>
      </main>
    </Page>
  );
}
