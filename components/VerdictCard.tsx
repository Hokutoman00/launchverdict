import type { VerdictCard as Card, VerdictCall } from "../lib/types.ts";
import styles from "./VerdictCard.module.css";

const ACCENT: Record<VerdictCall, string> = {
  ROLLBACK: "var(--rollback)",
  HOLD: "var(--hold)",
  SHIP_ON: "var(--shipon)",
  INSUFFICIENT: "var(--insufficient)",
};

const CALL_LABEL: Record<VerdictCall, string> = {
  ROLLBACK: "↩ ROLL IT BACK",
  HOLD: "⏸ HOLD",
  SHIP_ON: "✓ KEEP SHIPPING",
  INSUFFICIENT: "… NOT ENOUGH DATA",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function VerdictCard({ card }: { card: Card }) {
  const accent = ACCENT[card.call];
  return (
    <div className={styles.card} style={{ ["--accent" as string]: accent }}>
      <div className={styles.head}>
        <span className={styles.call}>{CALL_LABEL[card.call]}</span>
        <span className={styles.meta}>
          {card.repo} · {card.releaseId}
        </span>
      </div>

      <div className={styles.headline}>{card.headline}</div>

      {card.call !== "INSUFFICIENT" && (
        <>
          <div className={styles.rates}>
            <div className={styles.rate}>
              <div className={styles.rateLabel}>{card.movedFlow} · before</div>
              <div className={styles.rateNum}>{pct(card.before)}</div>
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: pct(card.before) }} />
              </div>
            </div>
            <span className={styles.arrow}>→</span>
            <div className={`${styles.rate} ${styles.after}`}>
              <div className={styles.rateLabel}>after</div>
              <div className={styles.rateNum}>{pct(card.after)}</div>
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: pct(card.after) }} />
              </div>
            </div>
          </div>
          <div className={styles.ci}>
            after-rate 95% CI: [{pct(card.ciLow)}, {pct(card.ciHigh)}]
          </div>
        </>
      )}

      <div className={styles.row}>
        <span className={styles.rowKey}>Cause</span>
        <span>{card.cause}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowKey}>Do this</span>
        <span className={styles.action}>{card.action}</span>
      </div>

      <div className={styles.foot}>
        <span className={styles.conf}>{card.confidence} confidence</span>
        <span className={styles.note}>{card.correlationNote}</span>
      </div>
    </div>
  );
}
