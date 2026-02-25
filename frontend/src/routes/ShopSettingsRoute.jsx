import { Page, sidenavItems } from "../components/page";
import { useShopRoute } from "./useShopRoute";
import { Flex } from "../components/flex";
import { Button, Card } from "@jackcrane/ui";

export function ShopSettingsRoute({ navigate, shopId }) {
  const { session, isPending, activeShop, isLoading, isSigningOut, onSignOut } =
    useShopRoute({
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
      title="Shop Settings"
      shopId={activeShop.id}
      loading={isLoading}
      sidenavItems={sidenavItems({
        activePage: "settings",
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
          label: "Shop Settings",
          href: "/shop/" + activeShop.id + "/settings",
        },
      ]}
    >
      <main>
        <Flex direction="row" gap={1} wrap="wrap">
          <Card
            title="Basic Settings"
            footerHeight={10}
            style={{
              minWidth: 300,
              maxWidth: 400,
              flex: 1,
            }}
          >
            <p style={{ marginTop: 0 }}>
              Set basic settings for your shop, including name, description, and
              contact information.
            </p>
            <Button
              type="button"
              onClick={() =>
                navigate(
                  `/shop/${encodeURIComponent(activeShop.id)}/settings/basic`,
                )
              }
            >
              Go
            </Button>
          </Card>
          <Card
            title="Authentication & Access"
            footerHeight={10}
            style={{
              minWidth: 300,
              maxWidth: 400,
              flex: 1,
            }}
          >
            <p style={{ marginTop: 0 }}>
              Set requirements for how users can access your shop, including
              single sign-on settings.
            </p>
            <Button type="button">Go</Button>
          </Card>
          <Card
            title="Tools & Tabs"
            footerHeight={10}
            style={{
              minWidth: 300,
              maxWidth: 400,
              flex: 1,
            }}
          >
            <p style={{ marginTop: 0 }}>
              Configure what tabs are visible to shop visitors.
            </p>
            <Button type="button">Go</Button>
          </Card>
        </Flex>
      </main>
    </Page>
  );
}
