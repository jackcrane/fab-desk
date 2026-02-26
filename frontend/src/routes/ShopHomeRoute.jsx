import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";

export function ShopHomeRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading, isSigningOut, onSignOut } =
    useShopRoute({
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
      title={activeShop?.name ?? "Shop"}
      shopId={pageShopId}
      loading={pageLoading}
      sidenavItems={sidenavItems({
        activePage: "home",
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
            ]
          : []
      }
    >
      {activeShop ? (
        <main>
          <h1>Hello world</h1>
          <p>Route: /shop/:shopId</p>
          <p>Current shop: {activeShop.name}</p>
          <p>Organization: {activeShop.organization}</p>
          <p>Your role: {activeShop.role}</p>
          <p>Signed in as {session?.user?.email ?? "..."}</p>
          <button type="button" onClick={() => navigate("/shop")}>
            Switch shop
          </button>
          <button type="button" onClick={onSignOut} disabled={isSigningOut}>
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </main>
      ) : null}
    </Page>
  );
}
