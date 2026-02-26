import { useEffect, useState } from "react";
import styles from "./page.module.css";
import logo from "../../assets/logo.svg";
import { authClient } from "../../auth-client";
import { Button, Dropdown, Hatch } from "@jackcrane/ui";
import { clearActiveShopId } from "../../lib/active-shop";
import classNames from "classnames";
import { Link, useNavigate } from "react-router-dom";
import {
  IconBook,
  IconHome,
  IconMenu2,
  IconRobot,
  IconSettings,
} from "@tabler/icons-react";
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
  showHeader = true,
}) {
  const { data: session } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;
  }, [title]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileMenuOpen]);

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
              {
                label: "Profile",
                onClick: () => navigate(shopHomePath(shopId)),
              },
              { label: "Switch Shop", onClick: () => navigate("/shop") },
              { label: "Sign out", onClick: onSignOut },
            ]}
            triggerLabel={session.user.name ?? session.user.email}
          />
        ) : null}
      </Hatch>
      {sidenavItems ? (
        <SidenavLayout
          sidenavItems={sidenavItems}
          breadcrumbs={breadcrumbs}
          content={content}
          headerContent={headerContent || <h1>{title}</h1>}
          showHeader={showHeader}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />
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
            style={{
              color: "black",
            }}
          >
            A product of Crane Digital Platforms
          </a>
        </small>
      </footer>
      {sidenavItems && !isMobileMenuOpen ? (
        <div className={styles.mobileMenuFab}>
          <Button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isMobileMenuOpen}
            aria-label="Open navigation menu"
          >
            <IconMenu2 size={20} strokeWidth={2} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const SidenavLayout = ({
  sidenavItems,
  breadcrumbs,
  content,
  headerContent,
  showHeader,
  isMobileMenuOpen,
  onCloseMobileMenu,
}) => {
  return (
    <>
      <div className={styles.contentWrap}>
        <SidenavContent items={sidenavItems} />
        <div className={styles.contentArea}>
          <PageContent
            breadcrumbs={breadcrumbs}
            content={content}
            headerContent={headerContent}
            showHeader={showHeader}
          />
        </div>
      </div>
      {isMobileMenuOpen ? (
        <div
          className={styles.mobileMenuSheet}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className={styles.mobileMenuBackdrop}
            aria-label="Close navigation menu"
            onClick={onCloseMobileMenu}
          />
          <div className={styles.mobileMenuPanel}>
            <SidenavContent
              items={sidenavItems}
              className={styles.mobileSidenav}
              itemClassName={styles.mobileSidenavItem}
              labelClassName={styles.mobileSidenavLabel}
              topGrowClassName={styles.mobileSidenavTopGrow}
              onTopGrowClick={onCloseMobileMenu}
              hideGrow
              onItemClick={onCloseMobileMenu}
            />
          </div>
        </div>
      ) : null}
    </>
  );
};

const SidenavContent = ({
  items,
  className,
  itemClassName,
  labelClassName,
  topGrowClassName,
  onTopGrowClick,
  hideGrow = false,
  onItemClick,
}) => {
  return (
    <div className={classNames(styles.sidenav, className)}>
      {topGrowClassName ? (
        <div className={topGrowClassName} onClick={onTopGrowClick} />
      ) : null}
      {items.map((item, index) =>
        item.type === "grow" ? (
          hideGrow ? null : (
            <div
              key={`grow-${index}`}
              style={{
                flex: 1,
                borderBottom: item.noBorderBottom
                  ? "none"
                  : "1px solid var(--border-color)",
              }}
            />
          )
        ) : (
          <Link
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={classNames(
              item.active ? classNames(styles.active, "jcui_hatch") : null,
              itemClassName,
            )}
            style={{
              borderBottom: item.noBorderBottom
                ? "none"
                : "1px solid var(--border-color)",
            }}
          >
            {item.icon}
            <div className={classNames(styles.label, labelClassName)}>
              {item.label}
            </div>
          </Link>
        ),
      )}
    </div>
  );
};

const PageContent = ({ breadcrumbs, content, headerContent, showHeader }) => {
  return (
    <div className={styles.content}>
      {breadcrumbs.length > 0 && <Breadcrumbs breadcrumbs={breadcrumbs} />}
      {headerContent && showHeader ? (
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
          <Link
            to={breadcrumb.href}
            className={index === breadcrumbs.length - 1 ? styles.active : null}
          >
            {breadcrumb.label}
          </Link>

          {index < breadcrumbs.length - 1 ? (
            <span className={styles.separator}>/</span>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export const sidenavItems = ({ activePage, shopId, showSettings = true }) => {
  const homePath = shopHomePath(shopId);

  const items = [
    {
      path: homePath,
      label: "Home",
      active: activePage === "home",
      icon: <IconHome size={32} strokeWidth={1.5} />,
    },
    {
      path: `${homePath}/jobs`,
      label: "Jobs",
      active: activePage === "jobs",
      icon: <IconRobot size={32} strokeWidth={1.5} />,
    },
    {
      path: `${homePath}/kb`,
      label: "Knowledge Base",
      active: activePage === "kb",
      icon: <IconBook size={32} strokeWidth={1.5} />,
    },
    {
      type: "grow",
      noBorderBottom: !showSettings,
    },
  ];

  if (showSettings) {
    items.push({
      path: `${homePath}/settings`,
      label: "Shop Settings",
      active: activePage === "settings",
      icon: <IconSettings size={32} strokeWidth={1.5} />,
      noBorderBottom: true,
    });
  }

  return items;
};
