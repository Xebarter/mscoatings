/** Retention / capacity knobs for long offline runs (days of shop traffic). */

/** Local mirror of completed sales kept for receipts, reports, void lookups. */
export const LOCAL_SALES_RETENTION = 5_000;

/** Local stock movement history retained offline. */
export const LOCAL_MOVEMENTS_RETENTION = 5_000;

/** Local field picks retained offline. */
export const LOCAL_FIELD_PICKS_RETENTION = 1_000;

/** Local expenses retained offline. */
export const LOCAL_EXPENSES_RETENTION = 2_000;

/** Local credit customers retained offline. */
export const LOCAL_CREDIT_CUSTOMERS_RETENTION = 1_000;

/** Local credit purchases retained offline. */
export const LOCAL_CREDIT_PURCHASES_RETENTION = 2_000;

/** Local credit transactions retained offline. */
export const LOCAL_CREDIT_TRANSACTIONS_RETENTION = 5_000;

/** Local field agent transactions retained offline. */
export const LOCAL_FIELD_AGENT_TX_RETENTION = 2_000;

/** Soft warning: prompt operator to reconnect soon. */
export const PENDING_WARN_COUNT = 400;

/** Strong warning: storage risk / sync will take a while. */
export const PENDING_CRITICAL_COUNT = 1_500;

/** Refuse new non-critical offline images past this many pending uploads. */
export const PENDING_IMAGE_MAX = 80;

/** When free disk (estimated) drops below this (MB), warn operator. */
export const STORAGE_LOW_MB = 200;

/** When free disk drops below this (MB), treat as critical. */
export const STORAGE_CRITICAL_MB = 50;
