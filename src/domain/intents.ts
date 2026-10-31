export const INTENTS = [
  'order_status',
  'shipping_delivery',
  'return_exchange',
  'refund_status',
  'order_cancellation',
  'product_information',
  'damaged_defective_product',
  'payment_issue',
  'discount_promotion',
  'missing_incorrect_items',
] as const;

export const UNKNOWN = 'unknown';

// Intents the policy documents (returns, shipping, discounts) can answer. Everything else is flagged for a human:
// order status/cancellation and payment issues need order or payment data, product questions need a catalogue.
export const POLICY_INTENTS = [
  'return_exchange',
  'refund_status',
  'shipping_delivery',
  'discount_promotion',
  'damaged_defective_product',
  'missing_incorrect_items',
] as const satisfies readonly (typeof INTENTS)[number][];
