import { usePathname } from "./hooks/usePathname";
import { HomeRoute } from "./routes/HomeRoute";
import { SignInRoute } from "./routes/SignInRoute/index";
import { SignUpRoute } from "./routes/SignUpRoute";
import { ProtectedAppRoute } from "./routes/ProtectedAppRoute";
import { NotFoundRoute } from "./routes/NotFoundRoute";
import { ShopSelectRoute } from "./routes/ShopSelectRoute";

export default function App() {
  const { pathname, navigate } = usePathname();

  if (pathname === "/") return <HomeRoute navigate={navigate} />;
  if (pathname === "/sign-in") return <SignInRoute navigate={navigate} />;
  if (pathname === "/sign-up") return <SignUpRoute navigate={navigate} />;
  if (pathname === "/select-shop") return <ShopSelectRoute navigate={navigate} />;
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return <ProtectedAppRoute navigate={navigate} />;
  }

  return <NotFoundRoute navigate={navigate} />;
}
