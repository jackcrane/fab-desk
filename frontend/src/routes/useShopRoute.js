import { useEffect, useState } from "react";
import { authClient } from "../auth-client";
import {
  clearActiveShopId,
  getActiveShopId,
  setActiveShopId,
} from "../lib/active-shop";
import { listShops } from "../lib/shop-api";

export function useShopRoute({ navigate, shopId }) {
  const { data: session, isPending } = authClient.useSession();
  const [activeShop, setActiveShop] = useState(null);
  const [isCheckingShop, setIsCheckingShop] = useState(true);
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

    if (!shopId) {
      navigate("/shop", true);
      return;
    }

    if (getActiveShopId() !== shopId) {
      setActiveShopId(shopId);
    }

    let cancelled = false;
    setIsCheckingShop(true);

    listShops()
      .then((shops) => {
        if (cancelled) {
          return;
        }

        const selectedShop = shops.find((shop) => shop.id === shopId);
        if (!selectedShop) {
          clearActiveShopId();
          navigate("/shop", true);
          return;
        }

        setActiveShop(selectedShop);
      })
      .catch(() => {
        if (!cancelled) {
          clearActiveShopId();
          navigate("/shop", true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingShop(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isPending, navigate, session, shopId]);

  const onSignOut = async () => {
    setIsSigningOut(true);
    clearActiveShopId();
    await authClient.signOut();
    setIsSigningOut(false);
    navigate("/sign-in", true);
  };

  return {
    session,
    isPending,
    activeShop,
    isLoading: isPending || isCheckingShop,
    isSigningOut,
    onSignOut,
  };
}
