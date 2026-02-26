import { useEffect, useMemo, useState } from "react";
import { authClient } from "../auth-client";
import {
  clearActiveShopId,
  getActiveShopId,
  setActiveShopId,
} from "../lib/active-shop";
import { needsNameCompletion } from "../lib/profile-name";
import { useShopsQuery } from "../lib/shops-orpc";

export function useShopRoute({ navigate, shopId }) {
  const { data: session, isPending } = authClient.useSession();
  const shouldCompleteProfile = needsNameCompletion(session?.user);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const canQueryShops = !!shopId && !shouldCompleteProfile;
  const {
    data: shops,
    error: shopsError,
    isLoading: isLoadingShops,
  } = useShopsQuery({
    enabled: canQueryShops,
    shouldRetryOnError: false,
  });

  const activeShop = useMemo(() => {
    if (!shopId || !shops) {
      return null;
    }

    return shops.find((shop) => shop.id === shopId) ?? null;
  }, [shopId, shops]);

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/sign-in", true);
    }
  }, [isPending, navigate, session]);

  useEffect(() => {
    if (!isPending && session && shouldCompleteProfile) {
      clearActiveShopId();
      navigate("/complete-profile", true);
    }
  }, [isPending, navigate, session, shouldCompleteProfile]);

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
  }, [isPending, navigate, session, shopId]);

  useEffect(() => {
    if (!canQueryShops || isLoadingShops) {
      return;
    }

    if (shopsError) {
      const errorCode =
        typeof shopsError === "object" && shopsError
          ? shopsError.code
          : undefined;

      if (errorCode === "UNAUTHORIZED") {
        clearActiveShopId();
        navigate("/sign-in", true);
        return;
      }

      clearActiveShopId();
      navigate("/shop", true);
      return;
    }

    if (!activeShop) {
      clearActiveShopId();
      navigate("/shop", true);
    }
  }, [
    activeShop,
    canQueryShops,
    isLoadingShops,
    navigate,
    shopsError,
  ]);

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
    isLoading:
      (canQueryShops && isLoadingShops) ||
      (!activeShop && isPending) ||
      shouldCompleteProfile,
    isSigningOut,
    onSignOut,
  };
}
