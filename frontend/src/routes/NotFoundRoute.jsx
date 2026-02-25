import { Button, Card } from "@jackcrane/ui";
import { DitherMeshGradientFill } from "../components/dither/dither";
import { Page } from "../components/page";
import style from "./NotFoundRoute.module.css";

export function NotFoundRoute({ navigate }) {
  return (
    <Page title="404">
      <main className={style.main}>
        <DitherMeshGradientFill />
        <Card
          title="404"
          footer={
            <Button type="button" onClick={() => navigate("/")}>
              Go home
            </Button>
          }
          footerHeight={40}
        >
          <div className={style.content}>
            <p className={style.kicker}>Page not found</p>
            <p className={style.description}>
              The page you requested does not exist or may have moved.
            </p>
          </div>
        </Card>
      </main>
    </Page>
  );
}
