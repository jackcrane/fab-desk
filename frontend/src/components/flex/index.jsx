import { u } from "../../lib/units";
import styles from "./flex.module.css";

export const Flex = ({
  children,
  gap = 0,
  direction = "column",
  align,
  justify,
  ...props
}) => {
  return (
    <div
      className={styles.flex}
      style={{
        display: "flex",
        gap: u(gap),
        flexDirection: direction,
        alignItems: align,
        justifyContent: justify,
        ...props.style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
