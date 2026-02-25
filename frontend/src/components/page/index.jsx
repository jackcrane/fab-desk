import { useEffect } from "react";
import styles from "./page.module.css";
import logo from "../../assets/logo.svg";

const APP_NAME = "FabDesk";

export function Page({ title, children }) {
  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;
  }, [title]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src={logo} alt={APP_NAME} className={styles.logo} />
        </div>
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
