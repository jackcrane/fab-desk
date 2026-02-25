import { usePathname } from "./hooks/usePathname";
import { HomeRoute } from "./routes/HomeRoute";
import { SignInRoute } from "./routes/SignInRoute/index";
import { SignUpRoute } from "./routes/SignUpRoute";
import { ProtectedAppRoute } from "./routes/ProtectedAppRoute";
import { NotFoundRoute } from "./routes/NotFoundRoute";
import { Page } from "./components/page";

export default function App() {
  const { pathname, navigate } = usePathname();

  let title = "Not Found";
  let content = <NotFoundRoute navigate={navigate} />;

  if (pathname === "/") {
    title = "Home";
    content = <HomeRoute navigate={navigate} />;
  } else if (pathname === "/sign-in") {
    title = "Sign In";
    content = <SignInRoute navigate={navigate} />;
  } else if (pathname === "/sign-up") {
    title = "Sign Up";
    content = <SignUpRoute navigate={navigate} />;
  } else if (pathname === "/app" || pathname.startsWith("/app/")) {
    title = "App";
    content = <ProtectedAppRoute navigate={navigate} />;
  }

  return <Page title={title}>{content}</Page>;
}
