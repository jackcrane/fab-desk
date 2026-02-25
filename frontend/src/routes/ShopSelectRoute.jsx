import { useCallback, useEffect, useState } from "react";
import { Button, Card, Hatch, Input } from "@jackcrane/ui";
import { authClient } from "../auth-client";
import { Flex } from "../components/flex";
import { Page } from "../components/page";
import {
  clearActiveShopId,
  getActiveShopId,
  setActiveShopId,
} from "../lib/active-shop";
import { createShop, listShops } from "../lib/shop-api";
import style from "./ShopSelectRoute.module.css";

function normalizeField(value) {
  return value.trim();
}

export function ShopSelectRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const [shops, setShops] = useState([]);
  const [isLoadingShops, setIsLoadingShops] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setIsCreating(true);

    const payload = {
      name: normalizeField(name),
      organization: normalizeField(organization),
      primaryContactEmail: normalizeField(primaryContactEmail),
    };

    try {
      const createdShop = await createShop(payload);
      setShops((previousShops) => [...previousShops, createdShop]);
      setName("");
      setOrganization("");
      setPrimaryContactEmail("");
      setActiveShopId(createdShop.id);
      navigate("/app", true);
    } catch (error) {
      setFormError(error?.message ?? "Unable to create shop");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Page title="Select Shop">
      <main className={style.main}>
        <section className={style.shell}>
          <Card title="Choose a shop">
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
                      You do not belong to any shops yet. Create one below.
                    </Hatch>
                  ) : (
                    <ul className={style.shopList}>
                      {shops.map((shop) => (
                        <li className={style.shopItem} key={shop.id}>
                          <div>
                            <h3>{shop.name}</h3>
                            <p>{shop.organization}</p>
                            <small>
                              Role: {shop.role} | Primary contact:{" "}
                              {shop.primaryContactEmail}
                            </small>
                          </div>
                          <Button
                            type="button"
                            onClick={() => onSelectShop(shop.id)}
                            variant="primary"
                          >
                            {activeShopId === shop.id
                              ? "Continue"
                              : "Enter shop"}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
            </div>
          </Card>
          <Card title="Create a new shop">
            <div className={style.form}>
              <form onSubmit={onSubmit}>
                <Flex gap={2}>
                  <Input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    label="Shop name"
                    placeholder="Downtown Fab Shop"
                  />
                  <Input
                    type="text"
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                    required
                    label="Organization"
                    placeholder="Crane Manufacturing Group"
                  />
                  <Input
                    type="email"
                    value={primaryContactEmail}
                    onChange={(event) =>
                      setPrimaryContactEmail(event.target.value)
                    }
                    label="Primary contact email (optional)"
                    placeholder="ops@example.com"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isCreating}
                    loading={isCreating}
                  >
                    {isCreating ? "Creating..." : "Create shop"}
                  </Button>
                  {formError ? (
                    <Hatch variant="danger" footerHeight={12}>
                      {formError}
                    </Hatch>
                  ) : null}
                </Flex>
              </form>
            </div>
          </Card>
        </section>
      </main>
    </Page>
  );
}
