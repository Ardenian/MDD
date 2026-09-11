/** Who a record is being written for — stamped onto every AggregateMeta (ADR 0003). */
export interface Identity {
  readonly ownerId: string;
  readonly userId: string;
}
