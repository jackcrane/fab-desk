import { useEffect, useState } from "react";
import { Button, Card, Hatch, Input, useModal } from "@jackcrane/ui";
import { authClient } from "../../auth-client";
import { Page } from "../../components/page";
import { DitherMeshGradientFill } from "../../components/dither/dither";
import { clearActiveShopId, setActiveShopId } from "../../lib/active-shop";
import { useCreateShopMutation, useShopsQuery } from "../../lib/shops-orpc";
import style from "./ShopSelectRoute.module.css";
import { Flex } from "../../components/flex";

function shopPath(shopId) {
  return `/shop/${encodeURIComponent(shopId)}`;
}

export function ShopSelectRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const {
    data: shops = [],
    error: shopsError,
    isLoading: isLoadingShops,
  } = useShopsQuery({
    enabled: !isPending,
    shouldRetryOnError: false,
  });
  const { trigger: createShop, isMutating: isCreating } = useCreateShopMutation();
  const [shopName, setShopName] = useState("");
  const [organization, setOrganization] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      clearActiveShopId();
      navigate("/sign-in", true);
    }
  }, [isPending, navigate, session]);

  const onCreateShop = async (event) => {
    event.preventDefault();
    setCreateError("");

    const normalizedName = shopName.trim();
    const normalizedOrganization = organization.trim();
    const normalizedPrimaryContactEmail = primaryContactEmail.trim();

    if (!normalizedName || !normalizedOrganization) {
      setCreateError("Shop name and organization are required");
      return;
    }

    try {
      const createdShop = await createShop({
        name: normalizedName,
        organization: normalizedOrganization,
        primaryContactEmail: normalizedPrimaryContactEmail,
      });

      setShopName("");
      setOrganization("");
      setPrimaryContactEmail("");
      setActiveShopId(createdShop.id);
      navigate(shopPath(createdShop.id), true);
    } catch (error) {
      setCreateError(error?.message ?? "Unable to create shop");
    }
  };

  const { Modal, setOpen } = useModal({
    title: "Create a new shop",
    content: (
      <form onSubmit={onCreateShop} className={style.modalForm}>
        <Flex gap={2}>
          <Input
            type="text"
            value={shopName}
            onChange={(event) => setShopName(event.target.value)}
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
            placeholder="Manufacturing Co"
          />
          <Input
            type="email"
            value={primaryContactEmail}
            onChange={(event) => setPrimaryContactEmail(event.target.value)}
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
          {createError ? (
            <Hatch variant="danger" footerHeight={12}>
              {createError}
            </Hatch>
          ) : null}
        </Flex>
      </form>
    ),
  });

  if (!isPending && !session) {
    return null;
  }

  const loadError = shopsError?.message ?? "";

  const onSelectShop = (shopId) => {
    setActiveShopId(shopId);
    navigate(shopPath(shopId), true);
  };

  return (
    <Page title="Select Shop" loading={isPending || (!!session && isLoadingShops)}>
      <DitherMeshGradientFill />
      <Modal />
      <main className={style.main}>
        <div className={style.dither}></div>
        <div className={style.cardWrap}>
          <Card
            title="Select Shop"
            footer={
              <Button
                type="button"
                onClick={() => {
                  setOpen(true);
                }}
              >
                Create a new shop
              </Button>
            }
            footerHeight={40}
          >
            <div className={style.panel}>
              <p className={style.kicker}>
                Your account can access multiple shops. Pick one to continue.
              </p>
              {loadError ? (
                <Hatch variant="danger" footerHeight={12}>
                  {loadError}
                </Hatch>
              ) : null}
              {!loadError ? (
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
