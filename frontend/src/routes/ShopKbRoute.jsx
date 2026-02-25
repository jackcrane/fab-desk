import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";

export function ShopKbRoute({ navigate, shopId }) {
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
      title="Knowledge Base"
      shopId={pageShopId}
      loading={pageLoading}
      sidenavItems={sidenavItems({
        activePage: "kb",
        shopId: pageShopId,
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
                label: "Knowledge Base",
                href: "/shop/" + activeShop.id + "/kb",
              },
            ]
          : []
      }
    >
      {activeShop ? (
        <main>
          <h1>Knowledge Base</h1>
          <p>Route: /shop/:shopId/kb</p>
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
