import { usePathname } from "./hooks/usePathname";
import { HomeRoute } from "./routes/HomeRoute";
import { SignInRoute } from "./routes/SignInRoute/index";
import { SignUpRoute } from "./routes/SignUpRoute";
import { ShopHomeRoute } from "./routes/ShopHomeRoute";
import { ShopKbRoute } from "./routes/ShopKbRoute";
import { ShopSettingsRoute } from "./routes/ShopSettingsRoute";
import { ShopBasicSettingsRoute } from "./routes/ShopBasicSettingsRoute";
import { NotFoundRoute } from "./routes/NotFoundRoute";
import { ShopSelectRoute } from "./routes/ShopSelectRoute";

function parseShopRoute(pathname) {
  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  const basicSettingsMatch = normalizedPath.match(
    /^\/shop\/([^/]+)\/settings\/basic$/,
  );
  if (basicSettingsMatch) {
    return {
      shopId: decodeURIComponent(basicSettingsMatch[1]),
      page: "settings-basic",
    };
  }

  const kbMatch = normalizedPath.match(/^\/shop\/([^/]+)\/kb$/);
  if (kbMatch) {
    return {
      shopId: decodeURIComponent(kbMatch[1]),
      page: "kb",
    };
  }

  const settingsMatch = normalizedPath.match(/^\/shop\/([^/]+)\/settings$/);
  if (settingsMatch) {
    return {
      shopId: decodeURIComponent(settingsMatch[1]),
      page: "settings",
    };
  }

  const homeMatch = normalizedPath.match(/^\/shop\/([^/]+)$/);
  if (homeMatch) {
    return {
      shopId: decodeURIComponent(homeMatch[1]),
      page: "home",
    };
  }

  return null;
}

export default function App() {
  const { pathname, navigate } = usePathname();

  if (pathname === "/") return <HomeRoute navigate={navigate} />;
  if (pathname === "/sign-in") return <SignInRoute navigate={navigate} />;
  if (pathname === "/sign-up") return <SignUpRoute navigate={navigate} />;
  if (pathname === "/shop") return <ShopSelectRoute navigate={navigate} />;

  const shopRoute = parseShopRoute(pathname);
  if (shopRoute?.page === "home") {
    return <ShopHomeRoute navigate={navigate} shopId={shopRoute.shopId} />;
  }

  if (shopRoute?.page === "kb") {
    return <ShopKbRoute navigate={navigate} shopId={shopRoute.shopId} />;
  }

  if (shopRoute?.page === "settings") {
    return <ShopSettingsRoute navigate={navigate} shopId={shopRoute.shopId} />;
  }

  if (shopRoute?.page === "settings-basic") {
    return (
      <ShopBasicSettingsRoute navigate={navigate} shopId={shopRoute.shopId} />
    );
  }

  return <NotFoundRoute navigate={navigate} />;
}
