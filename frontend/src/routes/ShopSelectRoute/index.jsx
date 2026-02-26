import { useEffect, useState } from "react";
import { Button, Card, Hatch, Input, Radio, RadioGroup, useModal } from "@jackcrane/ui";
import { authClient } from "../../auth-client";
import { Page } from "../../components/page";
import { DitherMeshGradientFill } from "../../components/dither/dither";
import { clearActiveShopId, setActiveShopId } from "../../lib/active-shop";
import { needsNameCompletion } from "../../lib/profile-name";
import { useCreateShopMutation, useShopsQuery } from "../../lib/shops-orpc";
import style from "./ShopSelectRoute.module.css";
import { Flex } from "../../components/flex";

function shopPath(shopId) {
  return `/shop/${encodeURIComponent(shopId)}`;
}

function emailDomainFromAddress(email) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const atIndex = normalizedEmail.lastIndexOf("@");

  if (atIndex < 0 || atIndex === normalizedEmail.length - 1) {
    return "";
  }

  return normalizedEmail.slice(atIndex + 1);
}

export function ShopSelectRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const shouldCompleteProfile = needsNameCompletion(session?.user);
  const emailDomain = emailDomainFromAddress(session?.user?.email);
  const {
    data: shops = [],
    error: shopsError,
    isLoading: isLoadingShops,
  } = useShopsQuery({
    enabled: !isPending && !shouldCompleteProfile,
    shouldRetryOnError: false,
  });
  const { trigger: createShop, isMutating: isCreating } = useCreateShopMutation();
  const [shopName, setShopName] = useState("");
  const [organization, setOrganization] = useState("");
  const [primaryContactEmail, setPrimaryContactEmail] = useState("");
  const [membershipPolicy, setMembershipPolicy] = useState("invite-only");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      clearActiveShopId();
      navigate("/sign-in", true);
    }
  }, [isPending, navigate, session]);

  useEffect(() => {
    if (!isPending && session && shouldCompleteProfile) {
      clearActiveShopId();
      navigate("/complete-profile", true);
    }
  }, [isPending, navigate, session, shouldCompleteProfile]);

  const onCreateShop = async () => {
    setCreateError("");

    const normalizedName = shopName.trim();
    const normalizedOrganization = organization.trim();
    const normalizedPrimaryContactEmail = primaryContactEmail.trim();

    if (!normalizedName || !normalizedOrganization) {
      setCreateError("Shop name and organization are required");
      return;
    }

    if (membershipPolicy === "domain" && !emailDomain) {
      setCreateError("Unable to determine your email domain for domain-based access.");
      return;
    }

    try {
      const createdShop = await createShop({
        name: normalizedName,
        organization: normalizedOrganization,
        primaryContactEmail: normalizedPrimaryContactEmail,
        membershipPolicy,
        membershipEmailDomain: membershipPolicy === "domain" ? emailDomain : "",
      });

      setShopName("");
      setOrganization("");
      setPrimaryContactEmail("");
      setMembershipPolicy("invite-only");
      setActiveShopId(createdShop.id);
      navigate(shopPath(createdShop.id), true);
    } catch (error) {
      setCreateError(error?.message ?? "Unable to create shop");
    }
  };

  const { Modal, setOpen } = useModal({
    title: "Create a new shop",
    content: (
      <form
        className={style.modalForm}
        onSubmitCapture={(event) => {
          event.preventDefault();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void onCreateShop();
        }}
      >
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
          <div className={style.accessPolicy}>
            <label className={style.accessPolicyLabel} id="shop-join-policy-label">
              Who can join this shop?
            </label>
            <RadioGroup
              className={style.accessPolicyOptions}
              value={membershipPolicy}
              onValueChange={setMembershipPolicy}
              aria-labelledby="shop-join-policy-label"
            >
              <Radio value="invite-only" label="Only people I invite" variant="secondary" />
              <Radio
                value="domain"
                label={
                  emailDomain
                    ? `Anyone with an email ending in @${emailDomain}`
                    : "Anyone with an email ending in your domain"
                }
                variant="secondary"
                disabled={!emailDomain}
              />
            </RadioGroup>
          </div>
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

  if (!isPending && session && shouldCompleteProfile) {
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
