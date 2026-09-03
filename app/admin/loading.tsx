import styles from "./loading.module.css";

const metricKeys = ["portal", "eligible", "linked", "sync"];
const rowKeys = ["member-a", "member-b", "member-c", "member-d", "member-e"];

export default function AdminLoading() {
  return (
    <section className={styles.page} aria-busy="true" aria-label="Loading admin page">
      <div className={styles.header}>
        <div className={`${styles.skeleton} ${styles.kicker}`} />
        <div className={`${styles.skeleton} ${styles.title}`} />
        <div className={`${styles.skeleton} ${styles.copy}`} />
      </div>

      <div className={styles.metrics}>
        {metricKeys.map((key) => (
          <div className={styles.metric} key={key}>
            <div className={`${styles.skeleton} ${styles.metricLabel}`} />
            <div className={`${styles.skeleton} ${styles.metricValue}`} />
            <div className={`${styles.skeleton} ${styles.metricDetail}`} />
          </div>
        ))}
      </div>

      <div className={styles.tabs}>
        <div className={`${styles.skeleton} ${styles.tab}`} />
        <div className={`${styles.skeleton} ${styles.tabShort}`} />
      </div>

      <div className={styles.toolbar}>
        <div className={`${styles.skeleton} ${styles.search}`} />
        <div className={`${styles.skeleton} ${styles.filter}`} />
        <div className={`${styles.skeleton} ${styles.filter}`} />
      </div>

      <div className={styles.surface}>
        <div className={styles.surfaceHeading}>
          <div>
            <div className={`${styles.skeleton} ${styles.sectionTitle}`} />
            <div className={`${styles.skeleton} ${styles.sectionCopy}`} />
          </div>
        </div>
        <div className={styles.table}>
          {rowKeys.map((key) => (
            <div className={styles.row} key={key}>
              <div className={`${styles.skeleton} ${styles.avatar}`} />
              <div className={styles.rowText}>
                <div className={`${styles.skeleton} ${styles.name}`} />
                <div className={`${styles.skeleton} ${styles.meta}`} />
              </div>
              <div className={`${styles.skeleton} ${styles.status}`} />
              <div className={`${styles.skeleton} ${styles.action}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
