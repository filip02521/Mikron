/** Wspólny select pól prośby do powiązań ZK (notatnik, zamykanie sprawy). */
export const ZK_LINKABLE_ORDER_SELECT =
  "id, sales_person_id, sales_client_name, sales_client_kh_id, source_zk_watch_id, source_zk_number, subiekt_tw_id, symbol, products, mikran_code, quantity, delivered_quantity, status, request_kind, ordered_at, action_at, delivery_at, zd_fulfillment_deadline, zd_fulfillment_previous_deadline, zd_fulfillment_deadline_changed_at, zd_fulfillment_deadline_change_seen_at, sales_acknowledged_at, sales_cancelled_at";

/** Prośby potencjalnie wymagające potwierdzenia w /moje. */
export const ZK_PENDING_ACK_OR_FILTER =
  "sales_cancelled_at.is.null,sales_acknowledged_at.is.null,and(zd_fulfillment_deadline_changed_at.not.is.null,zd_fulfillment_deadline_change_seen_at.is.null)";
