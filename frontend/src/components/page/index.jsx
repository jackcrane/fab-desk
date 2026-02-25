import { useEffect, useState } from "react";
import styles from "./page.module.css";
import logo from "../../assets/logo.svg";
import { authClient } from "../../auth-client";
import { Dropdown } from "@jackcrane/ui";

const APP_NAME = "FabDesk";

export function Page({ title, children }) {
  const { data: session } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;
  }, [title]);

  const onSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src={logo} alt={APP_NAME} className={styles.logo} />
        </div>
        {session ? (
          <Dropdown
            items={[
              { label: "Profile", href: "/app/profile" },
              { label: "Sign out", onClick: onSignOut },
            ]}
            triggerLabel={session.user.name ?? session.user.email}
          />
        ) : null}
      </header>
      <div className={styles.content}>{children}</div>
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
