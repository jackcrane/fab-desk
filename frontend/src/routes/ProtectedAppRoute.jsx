import { useEffect, useState } from "react";
import { authClient } from "../auth-client";
import { Page, sidenavItems } from "../components/page";
import { clearActiveShopId, getActiveShopId } from "../lib/active-shop";
import { listShops } from "../lib/shop-api";

export function ProtectedAppRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const [activeShop, setActiveShop] = useState(null);
  const [isCheckingShop, setIsCheckingShop] = useState(true);
  const [shopError, setShopError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/sign-in", true);
    }
  }, [isPending, navigate, session]);

  useEffect(() => {
    if (isPending || !session) {
      return;
    }

    const activeShopId = getActiveShopId();
    if (!activeShopId) {
      navigate("/select-shop", true);
      return;
    }

    let cancelled = false;
    setShopError("");
    setIsCheckingShop(true);

    listShops()
      .then((shops) => {
        if (cancelled) {
          return;
        }

        const selectedShop = shops.find((shop) => shop.id === activeShopId);
        if (!selectedShop) {
          clearActiveShopId();
          navigate("/select-shop", true);
          return;
        }

        setActiveShop(selectedShop);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setShopError(error?.message ?? "Unable to verify shop access");
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingShop(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isPending, navigate, session]);

  if (!isPending && !session) {
    return null;
  }

  const onSignOut = async () => {
    setIsSigningOut(true);
    clearActiveShopId();
    await authClient.signOut();
    setIsSigningOut(false);
    navigate("/sign-in", true);
  };

  const isLoading = isPending || isCheckingShop;
  const hasActiveShop = Boolean(activeShop);

  if (!hasActiveShop) return null;

  return (
    <Page
      title="App"
      loading={isLoading && hasActiveShop}
      sidenavItems={sidenavItems({
        activePage: "home",
      })}
    >
      <main>
        <h1>Hello world</h1>
        <p>Protected route: /app</p>
        <p>Current shop: {activeShop.name}</p>
        <p>Organization: {activeShop.organization}</p>
        <p>Your role: {activeShop.role}</p>
        <p>Signed in as {session.user.email}</p>
        <button type="button" onClick={() => navigate("/select-shop")}>
          Switch shop
        </button>
        <button type="button" onClick={onSignOut} disabled={isSigningOut}>
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </main>
    </Page>
  );
}
