import styles from "./table.module.css";

function onStopRowNavigation(event) {
  event.stopPropagation();
}

function renderCellValue(row, column) {
  if (typeof column.render === "function") {
    return column.render(row);
  }

  if (typeof column.accessor === "function") {
    return column.accessor(row);
  }

  if (typeof column.accessor === "string") {
    return row?.[column.accessor] ?? "";
  }

  if (typeof column.key === "string") {
    return row?.[column.key] ?? "";
  }

  return "";
}

export function Table({
  rows = [],
  columns = [],
  onClickRow,
  rowKey = (row, index) => row?.id ?? index,
  emptyMessage = "No rows to display.",
}) {
  const clickableRows = typeof onClickRow === "function";

  return (
    <table className={styles.table}>
      <thead className="jcui_chamfer">
        <tr className="jcui_hatch">
          {columns.map((column, index) => (
            <th key={column.key ?? column.header ?? index}>{column.header ?? ""}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className={styles.row}>
            <td colSpan={Math.max(columns.length, 1)} className={styles.empty}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row, rowIndex) => (
            <tr
              key={rowKey(row, rowIndex)}
              className={`${styles.row} ${clickableRows ? styles.rowClickable : ""}`}
              onClick={
                clickableRows
                  ? () => {
                      onClickRow(row, rowIndex);
                    }
                  : undefined
              }
              onKeyDown={(event) => {
                if (!clickableRows) {
                  return;
                }

                if (event.target !== event.currentTarget) {
                  return;
                }

                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onClickRow(row, rowIndex);
                }
              }}
              role={clickableRows ? "button" : undefined}
              tabIndex={clickableRows ? 0 : undefined}
            >
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key ?? column.header ?? columnIndex}
                  onClick={column.stopRowClick ? onStopRowNavigation : undefined}
                  onPointerDown={column.stopRowClick ? onStopRowNavigation : undefined}
                >
                  {renderCellValue(row, column)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
