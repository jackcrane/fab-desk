import { u } from "../../lib/units";
import styles from "./flex.module.css";

export const Flex = ({
  children,
  gap = 0,
  direction = "column",
  align,
  justify,
  wrap = "nowrap",
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
        flexWrap: wrap,
        ...props.style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
