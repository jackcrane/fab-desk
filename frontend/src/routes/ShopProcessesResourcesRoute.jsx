import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";

export function ShopProcessesResourcesRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading } = useShopRoute({
    navigate,
    shopId,
  });
  const pageShopId = activeShop?.id ?? shopId;
  const pageLoading = isLoading || !activeShop;

  if (!isPending && !session) {
    return null;
  }

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
      {activeShop ? <main /> : null}
    </Page>
  );
}
