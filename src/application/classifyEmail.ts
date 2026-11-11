import { UNKNOWN } from "../domain/intents.js";
import { parseClassification, type Classification } from "../domain/parseClassification.js";
import type { Llm } from "./ports.js";

export const PROMPT_VERSION = "v2";

const buildPrompt = (email: string) => `Classify the email below into exactly one of these intents:
- order_status: where an order is, or whether it has been processed or shipped
- shipping_delivery: shipping options, costs and times, or a delivery that is late or has a problem
- return_exchange: sending an item back or swapping it for another
- refund_status: whether or when money will come back, or to which payment method
- order_cancellation: cancelling an order, or changing it before it ships
- product_information: questions about the product itself (features, sizes, materials, availability)
- damaged_defective_product: an item that arrived broken or does not work
- payment_issue: a failed, duplicate or wrong charge, or trouble paying
- discount_promotion: discount codes, sales and price adjustments
- missing_incorrect_items: an item that is missing from the delivery, or the wrong item arrived
If it fits none of them, use "${UNKNOWN}".

Rules:
- Pick the intent that matches what the customer is asking for in their current request. Earlier events they mention (a cancellation, a return, a purchase) are background, not the request.
- Long emails often hide one request among greetings and personal stories. Find the request and ignore the rest.
Reply with only JSON: {"intent": "<intent>", "confidence": <how sure you are, 0-100>}

<email>
${email}
</email>`;

export async function classifyEmail(email: string, llm: Llm): Promise<Classification> {
  return parseClassification(await llm.complete(buildPrompt(email)));
}
