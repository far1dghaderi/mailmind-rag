# Experiment log

One entry per change: what changed, the numbers before and after, and the decision. Baseline: 2026-11-06 (see PROJECT.md).

## 2026-11-08, answer prompt v1 -> v2 (target: one-word answers, cause 6 and the bare replies)

Tried four variants, each one full `npm run eval:qa` run on 80 questions. Columns: answerable answered / unanswerable refused / fact check (confirmed, wrong, need a human, refused).

| Variant | Answered | Refused | Fact check |
|---|---|---|---|
| Baseline v1 ("short answer") | 58/64 | 16/16 | 39, 5, 14, 6 |
| A: allow one inference + full sentences | 63/64 | 7/16 | 44, 6, 13, 1 |
| B: A plus "silence is not a no", generic examples | 62/64 | 5/16 | 44, 6, 12, 2 |
| C: full sentences only | 63/64 | 5/16 | 43, 5, 15, 1 |
| **D: model first sets `answerable` true/false, then writes the answer** | 50/64 | 16/16 | 32, 3, 15, 14 |

Findings:
- Asking for full sentences made the 8B model answer everything, including questions the policies cannot answer ("No" to the loyalty-points and price-matching questions). Telling it that silence is not a no did not help; the instruction was ignored.
- Variant A's examples (UK shipping, 20 days vs 14) mirrored eval questions q45 and q49, which is tuning on the test set, so they were removed in B.
- Variant D separates the decision from the wording (`answerable` is read by `parseAnswer`) and keeps refusals at 16/16.

Result of D: one-word answers 39/58 -> 0/50; wrong answers 5 -> 3 (q01, q20, q64 are now refused instead of answered wrongly); but 6 answerable questions that were right are now refused (q11, q16, q18, q42, q44, q58), so coverage fell from 58 to 50 answered. The 15 "need a human" answers have not been hand-checked.
