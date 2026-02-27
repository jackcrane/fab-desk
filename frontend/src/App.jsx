import { useCallback } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { HomeRoute } from "./routes/HomeRoute";
import { SignInRoute } from "./routes/SignInRoute/index";
import { SignUpRoute } from "./routes/SignUpRoute/index";
import { CompleteProfileRoute } from "./routes/CompleteProfileRoute/index";
import { ShopHomeRoute } from "./routes/ShopHomeRoute";
import { ShopKbRoute } from "./routes/ShopKbRoute";
import { ShopSettingsRoute } from "./routes/ShopSettingsRoute";
import { ShopBasicSettingsRoute } from "./routes/ShopBasicSettingsRoute";
import { ShopAccessSettingsRoute } from "./routes/ShopAccessSettingsRoute";
import { ShopJobsRoute } from "./routes/ShopJobsRoute/index";
import { ShopJobDetailRoute } from "./routes/ShopJobDetailRoute";
import { NotFoundRoute } from "./routes/NotFoundRoute/index";
import { ShopSelectRoute } from "./routes/ShopSelectRoute/index";

function useLegacyNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (to, replace = false) => {
      navigate(to, { replace });
    },
    [navigate],
  );
}

function HomeRoutePage() {
  const navigate = useLegacyNavigate();
  return <HomeRoute navigate={navigate} />;
}

function SignInRoutePage() {
  const navigate = useLegacyNavigate();
  return <SignInRoute navigate={navigate} />;
}

function SignUpRoutePage() {
  const navigate = useLegacyNavigate();
  return <SignUpRoute navigate={navigate} />;
}

function CompleteProfileRoutePage() {
  const navigate = useLegacyNavigate();
  return <CompleteProfileRoute navigate={navigate} />;
}

function ShopSelectRoutePage() {
  const navigate = useLegacyNavigate();
  return <ShopSelectRoute navigate={navigate} />;
}

function ShopHomeRoutePage() {
  const navigate = useLegacyNavigate();
  const { shopId = "" } = useParams();
  return <ShopHomeRoute navigate={navigate} shopId={shopId} />;
}

function ShopKbRoutePage() {
  const navigate = useLegacyNavigate();
  const { shopId = "" } = useParams();
  return <ShopKbRoute navigate={navigate} shopId={shopId} />;
}

function ShopJobsRoutePage() {
  const navigate = useLegacyNavigate();
  const { shopId = "" } = useParams();
  return <ShopJobsRoute navigate={navigate} shopId={shopId} />;
}

function ShopJobDetailRoutePage() {
  const navigate = useLegacyNavigate();
  const { shopId = "", jobId = "" } = useParams();
  return <ShopJobDetailRoute navigate={navigate} shopId={shopId} jobId={jobId} />;
}

function ShopSettingsRoutePage() {
  const navigate = useLegacyNavigate();
  const { shopId = "" } = useParams();
  return <ShopSettingsRoute navigate={navigate} shopId={shopId} />;
}

function ShopBasicSettingsRoutePage() {
  const navigate = useLegacyNavigate();
  const { shopId = "" } = useParams();
  return <ShopBasicSettingsRoute navigate={navigate} shopId={shopId} />;
}

function ShopAccessSettingsRoutePage() {
  const navigate = useLegacyNavigate();
  const { shopId = "" } = useParams();
  return <ShopAccessSettingsRoute navigate={navigate} shopId={shopId} />;
}

function NotFoundRoutePage() {
  const navigate = useLegacyNavigate();
  return <NotFoundRoute navigate={navigate} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoutePage />} />
      <Route path="/sign-in" element={<SignInRoutePage />} />
      <Route path="/sign-up" element={<SignUpRoutePage />} />
      <Route path="/complete-profile" element={<CompleteProfileRoutePage />} />
      <Route path="/shop" element={<ShopSelectRoutePage />} />
      <Route path="/shop/:shopId" element={<ShopHomeRoutePage />} />
      <Route path="/shop/:shopId/jobs" element={<ShopJobsRoutePage />} />
      <Route
        path="/shop/:shopId/jobs/:jobId"
        element={<ShopJobDetailRoutePage />}
      />
      <Route path="/shop/:shopId/kb" element={<ShopKbRoutePage />} />
      <Route
        path="/shop/:shopId/settings"
        element={<ShopSettingsRoutePage />}
      />
      <Route
        path="/shop/:shopId/settings/basic"
        element={<ShopBasicSettingsRoutePage />}
      />
      <Route
        path="/shop/:shopId/settings/access"
        element={<ShopAccessSettingsRoutePage />}
      />
      <Route path="*" element={<NotFoundRoutePage />} />
    </Routes>
  );
}
