import { Page, sidenavItems } from "../components/page";
import { useProtectedShopRoute } from "./useProtectedShopRoute";

export function ProtectedShopKbRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading, isSigningOut, onSignOut } =
    useProtectedShopRoute({
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
      title="Knowledge Base"
      shopId={activeShop.id}
      loading={isLoading}
      sidenavItems={sidenavItems({
        activePage: "kb",
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
          label: "Knowledge Base",
          href: "/shop/" + activeShop.id + "/kb",
        },
      ]}
    >
      <main>
        <h1>Knowledge Base</h1>
        <p>Protected route: /shop/:shopId/kb</p>
        <p>Current shop: {activeShop.name}</p>
        <p>Organization: {activeShop.organization}</p>
        <p>Your role: {activeShop.role}</p>
        <p>Signed in as {session.user.email}</p>
        <button type="button" onClick={() => navigate("/shop")}>
          Switch shop
        </button>
        <button type="button" onClick={onSignOut} disabled={isSigningOut}>
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </main>
    </Page>
  );
}
