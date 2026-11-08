# Baseline failures, sorted by cause

Source: `results/2026-11-06-qa-eval.json` and `results/2026-11-06-classification-eval.json` (llama3.1:8b, answer prompt v1, classification prompt v1, k=3, cutoff 0.6). Written 2026-11-08, before any improvement. Each cause is one improvement to try, one at a time, and the number that should move.

## Question answering: 20 of 64 answerable questions fail or are only partly right

Each question is counted once, under its first cause in the pipeline (retrieval, then cutoff, then the model).

| # | Cause | Questions | Count |
|---|---|---|---|
| 1 | The right chunk is not in the top 3: look-alike chunks (`preorders#6`, `returns#6`, `delivery#5`, `giftcards#3`) fill the slots | q01, q13, q43; multi-chunk: q05, q20, q26, q35, q41, q64 | 9 |
| 2 | The right chunk is in the top 3 but scores under the 0.6 cutoff and is dropped | q03, q14 | 2 |
| 3 | The right chunk is given to the model and it still declines (the answer needs one inference) | q45 (UK: the policy lists only US and Canada), q49 (20 days vs a 14-day window), q53 | 3 |
| 4 | The right chunk is given and the model gets a comparison wrong | q54 ($180 vs the $150 signature rule), q73 (2 hours vs a 60-minute link) | 2 |
| 5 | The answer is right but cites only some of the needed chunks | q59, q75, q77 | 3 |
| 6 | A two-part question gets only one part answered | q71 | 1 |

Knock-on effects of cause 1: 8 of the 11 answers with a wrong citation (q01, q05, q13, q20, q26, q35, q41, q64) and 5 of the 8 wrong or partly right answers that were not refusals (q01, q13, q64, q26, q41) come from a missing chunk, not from the model. The 6 multi-chunk misses are structural: 2 needed chunks cannot both be in the top 3 when look-alikes score higher.

Not a failure but a quality problem: 39 of the 58 answers are 3 words or fewer ("No", "Yes", "$12.99", "no"), because the prompt asks for a "short answer". They pass the fact check, but a customer cannot send them, and q01 and q73 show the model is least reliable when it answers in one word.

## Classification: 5 of 54 emails wrong

| Cause | Emails | Said (confidence) |
|---|---|---|
| The email mentions the topic of a neighbouring intent, and the prompt has no rule for choosing | clean #7 (a shipping charge on a receipt: shipping_delivery, said order_status 80), clean #15 (cancelled order, asks about the refund: refund_status, said order_cancellation 90), clean #37 (wrong color, wants the right one: missing_incorrect_items, said return_exchange 90) | 3 misses, two of them at 90 |
| The real request is buried under long unrelated text | messy #4 (wedding story, forgotten discount code: discount_promotion), messy #10 (dog and grandmother, asks about express shipping: shipping_delivery); both said product_information 80 | 2 misses |

Calibration: confidence 90-100 was right 33 of 35 times, 70-89 right 15 of 18 times. The two wrong 90s are the neighbouring-intent cases.

## Order to attack, one change per eval re-run

1. **Answer prompt v2**: allow one step of inference from the context, ask for a full sentence. Targets causes 3, 4, 6 and the one-word answers. Watch: answers correct (78%), answerable answered (90.6%), refusal accuracy must stay 100%.
2. **Retrieval**: try k=5 and a lower cutoff, then a reranker or hybrid search if that is not enough. Targets causes 1 and 2. Watch: top-3/top-k hit rate (85.9%), multi-chunk questions, and refusal accuracy (a lower cutoff lets more unanswerable questions reach the model).
3. **Citation rule**: ask the model to cite every chunk it used. Targets cause 5. Watch: citing a correct source (81.0%).
4. **Classification prompt v2**: add disambiguation rules for the neighbouring pairs and tell the model to look for the actual request. Watch: 49/54, messy 10/12, calibration of the 90+ bucket.
