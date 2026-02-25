import { usePathname } from "./hooks/usePathname";
import { HomeRoute } from "./routes/HomeRoute";
import { SignInRoute } from "./routes/SignInRoute/index";
import { SignUpRoute } from "./routes/SignUpRoute";
import { ProtectedShopHomeRoute } from "./routes/ProtectedShopHomeRoute";
import { ProtectedShopKbRoute } from "./routes/ProtectedShopKbRoute";
import { NotFoundRoute } from "./routes/NotFoundRoute";
import { ShopSelectRoute } from "./routes/ShopSelectRoute";

function parseShopRoute(pathname) {
  const normalizedPath =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  const kbMatch = normalizedPath.match(/^\/shop\/([^/]+)\/kb$/);
  if (kbMatch) {
    return {
      shopId: decodeURIComponent(kbMatch[1]),
      page: "kb",
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
    return (
      <ProtectedShopHomeRoute navigate={navigate} shopId={shopRoute.shopId} />
    );
  }

  if (shopRoute?.page === "kb") {
    return (
      <ProtectedShopKbRoute navigate={navigate} shopId={shopRoute.shopId} />
    );
  }

  return <NotFoundRoute navigate={navigate} />;
}
