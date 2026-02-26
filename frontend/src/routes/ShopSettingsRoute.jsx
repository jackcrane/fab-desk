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
  const pageShopId = activeShop?.id ?? shopId;
  const pageLoading = isLoading || !activeShop;

  if (!isPending && !session) {
    return null;
  }

  return (
    <Page
      title="Shop Settings"
      shopId={pageShopId}
      loading={pageLoading}
      sidenavItems={sidenavItems({
        activePage: "settings",
        shopId: pageShopId,
        showSettings: activeShop?.role === "ADMIN",
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
                label: "Shop Settings",
                href: "/shop/" + activeShop.id + "/settings",
              },
            ]
          : []
      }
    >
      {activeShop ? (
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
              <p style={{ marginBottom: 8 }}>
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
              <p style={{ marginBottom: 8 }}>
                Set requirements for how users can access your shop, including
                single sign-on settings.
              </p>
              <Button
                type="button"
                onClick={() =>
                  navigate(
                    `/shop/${encodeURIComponent(activeShop.id)}/settings/access`,
                  )
                }
              >
                Go
              </Button>
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
              <p style={{ marginBottom: 8 }}>
                Configure what tabs are visible to shop visitors.
              </p>
              <Button type="button">Go</Button>
            </Card>
          </Flex>
        </main>
      ) : null}
    </Page>
  );
}
