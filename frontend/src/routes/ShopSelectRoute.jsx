import { useCallback, useEffect, useState } from "react";
import { Button, Card, Hatch } from "@jackcrane/ui";
import { authClient } from "../auth-client";
import { Page } from "../components/page";
import { DitherMeshGradientFill } from "../components/dither/dither";
import {
  clearActiveShopId,
  getActiveShopId,
  setActiveShopId,
} from "../lib/active-shop";
import { listShops } from "../lib/shop-api";
import style from "./ShopSelectRoute.module.css";
import { Flex } from "../components/flex";

export function ShopSelectRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const [shops, setShops] = useState([]);
  const [isLoadingShops, setIsLoadingShops] = useState(true);
  const [loadError, setLoadError] = useState("");

  const activeShopId = getActiveShopId();

  const loadShops = useCallback(async () => {
    setLoadError("");
    setIsLoadingShops(true);

    try {
      const nextShops = await listShops();
      setShops(nextShops);
    } catch (error) {
      setLoadError(error?.message ?? "Unable to load shops");
    } finally {
      setIsLoadingShops(false);
    }
  }, []);

  useEffect(() => {
    if (!isPending && !session) {
      clearActiveShopId();
      navigate("/sign-in", true);
    }
  }, [isPending, navigate, session]);

  useEffect(() => {
    if (isPending || !session) {
      return;
    }

    loadShops();
  }, [isPending, loadShops, session]);

  if (isPending || (!session && !isPending)) {
    return null;
  }

  const onSelectShop = (shopId) => {
    setActiveShopId(shopId);
    navigate("/app", true);
  };

  return (
    <Page title="Select Shop">
      <DitherMeshGradientFill />
      <main className={style.main}>
        <div className={style.dither}></div>
        <div className={style.cardWrap}>
          <Card
            title="Select Shop"
            footer={
              <Button type="button" onClick={() => {}}>
                Create a new shop
              </Button>
            }
            footerHeight={40}
          >
            <div className={style.panel}>
              <p className={style.kicker}>
                Your account can access multiple shops. Pick one to continue.
              </p>
              {isLoadingShops ? <p>Loading shops...</p> : null}
              {loadError ? (
                <Hatch variant="danger" footerHeight={12}>
                  {loadError}
                </Hatch>
              ) : null}
              {!isLoadingShops && !loadError ? (
                <>
                  {shops.length === 0 ? (
                    <Hatch variant="warning" footerHeight={12}>
                      You do not belong to any shops yet.
                    </Hatch>
                  ) : (
                    <ul className={style.shopList}>
                      {shops.map((shop) => (
                        <Button
                          key={shop.id}
                          type="button"
                          onClick={() => onSelectShop(shop.id)}
                          style={{
                            alignItems: "flex-end",
                          }}
                        >
                          <Flex className={style.shopItem} align={"flex-start"}>
                            <h3>{shop.name}</h3>
                            <p>{shop.organization}</p>
                          </Flex>
                        </Button>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
            </div>
          </Card>
        </div>
      </main>
    </Page>
  );
}
