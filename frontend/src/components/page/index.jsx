import { useEffect, useState } from "react";
import styles from "./page.module.css";
import logo from "../../assets/logo.svg";
import { authClient } from "../../auth-client";
import { Dropdown, Hatch } from "@jackcrane/ui";
import { clearActiveShopId } from "../../lib/active-shop";

const APP_NAME = "FabDesk";

export function Page({
  title,
  children,
  sidenavItems,
  loading = false,
}) {
  const { data: session } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;
  }, [title]);

  const onSignOut = async () => {
    setIsSigningOut(true);
    try {
      clearActiveShopId();
      await authClient.signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  const content = loading ? (
    <div className={styles.loadingState} role="status" aria-live="polite">
      <p>Loading...</p>
    </div>
  ) : (
    children
  );

  return (
    <div className={styles.page}>
      <Hatch chamfer={false} className={styles.header}>
        <div className={styles.brand}>
          <img src={logo} alt={APP_NAME} className={styles.logo} />
        </div>
        {session ? (
          <Dropdown
            items={[
              { label: "Profile", href: "/app/profile" },
              { label: "Switch Shop", href: "/select-shop" },
              { label: "Sign out", onClick: onSignOut },
            ]}
            triggerLabel={session.user.name ?? session.user.email}
          />
        ) : null}
      </Hatch>
      {sidenavItems ? (
        <div className={styles.contentWrap}>
          <div className={styles.sidenav}>
            {sidenavItems.map((item) => (
              <a key={item.path} href={item.path}>
                {item.label}
              </a>
            ))}
          </div>
          <div className={styles.content}>{content}</div>
        </div>
      ) : (
        <div className={styles.content}>{content}</div>
      )}
      <footer className={styles.footer}>
        <small>
          &copy; {new Date().getFullYear()} {APP_NAME}
          <br />
          <a
            href="https://cranedigitalplatforms.com/"
            target="_blank"
            style={{ color: "black" }}
          >
            A product of Crane Digital Platforms
          </a>
        </small>
      </footer>
    </div>
  );
}
