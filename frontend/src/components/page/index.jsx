import { useEffect, useState } from "react";
import styles from "./page.module.css";
import logo from "../../assets/logo.svg";
import { authClient } from "../../auth-client";
import { Dropdown, Hatch } from "@jackcrane/ui";
import { clearActiveShopId } from "../../lib/active-shop";
import classNames from "classnames";
import { IconBook, IconHome, IconRobot } from "@tabler/icons-react";
import { DitherMeshGradientFill } from "../dither/dither";

const APP_NAME = "FabDesk";

function shopHomePath(shopId) {
  if (!shopId) {
    return "/shop";
  }

  return `/shop/${encodeURIComponent(shopId)}`;
}

export function Page({
  title,
  children,
  sidenavItems,
  loading = false,
  shopId,
  breadcrumbs = [],
  headerContent,
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
              { label: "Profile", href: shopHomePath(shopId) },
              { label: "Switch Shop", href: "/shop" },
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
              <a
                key={item.path}
                href={item.path}
                className={
                  item.active ? classNames(styles.active, "jcui_hatch") : null
                }
              >
                {item.icon}
                <div className={classNames(styles.label)}>{item.label}</div>
              </a>
            ))}
          </div>
          <PageContent
            breadcrumbs={breadcrumbs}
            content={content}
            headerContent={headerContent || <h1>{title}</h1>}
          />
        </div>
      ) : (
        <PageContent
          breadcrumbs={breadcrumbs}
          content={content}
          headerContent={headerContent || <h1>{title}</h1>}
        />
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

const PageContent = ({ breadcrumbs, content, headerContent }) => {
  return (
    <div className={styles.content}>
      {breadcrumbs.length > 0 && <Breadcrumbs breadcrumbs={breadcrumbs} />}
      {headerContent ? (
        <div className={styles.headerContent}>
          <DitherMeshGradientFill />
          {headerContent}
        </div>
      ) : null}
      <div className={styles.innerContent}>{content}</div>
    </div>
  );
};

const Breadcrumbs = ({ breadcrumbs }) => {
  return (
    <div className={styles.breadcrumbs}>
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={index}>
          <a
            href={breadcrumb.href}
            className={index === breadcrumbs.length - 1 ? styles.active : null}
          >
            {breadcrumb.label}
          </a>

          {index < breadcrumbs.length - 1 ? (
            <span className={styles.separator}>/</span>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export const sidenavItems = ({ activePage, shopId }) => {
  const homePath = shopHomePath(shopId);

  return [
    {
      path: homePath,
      label: "Home",
      active: activePage === "home",
      icon: <IconHome size={32} />,
    },
    {
      path: `${homePath}/jobs`,
      label: "Jobs",
      active: activePage === "jobs",
      icon: <IconRobot size={32} />,
    },
    {
      path: `${homePath}/kb`,
      label: "Knowledge Base",
      active: activePage === "kb",
      icon: <IconBook size={32} />,
    },
  ];
};
