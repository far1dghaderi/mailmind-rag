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

## 2026-11-11, retrieval k=3 / cutoff 0.6 -> k=5 / cutoff 0.55 (target: causes 1 and 2, missing or dropped chunks)

Chosen with `scripts/sweep-retrieval.ts`: one search per question with k=10, then every (k, cutoff) pair replayed offline, no model calls. Notable rows (right chunk kept / multi-chunk all kept / unanswerable questions that reach the model):

| k, cutoff | Right chunk | Multi-chunk | Unanswerable passing |
|---|---|---|---|
| 3, 0.60 (before) | 53/64 = 83% | 5/11 | 14/16 |
| 5, 0.55 (chosen) | 60/64 = 94% | 7/11 | 15/16 |
| 6, 0.55 | 61/64 = 95% | 8/11 | 15/16 |
| 8, 0.55 | 61/64 = 95% | 8/11 | 15/16 |

k=5 takes nearly all of the gain; 6 and 8 add one question each and put more look-alike text in the prompt. The cutoff barely discriminates: 14 of 16 unanswerable questions already scored above 0.6, so refusal rests on the model's `answerable` flag (prompt v2), not on retrieval.

Full eval with answer prompt v2 (columns: before = 2026-11-08 run at k=3 / 0.6, after = this run):

| Metric | Before | After |
|---|---|---|
| Right chunk kept | 53/64 = 82.8% | 60/64 = 93.8% |
| Answerable answered | 50/64 = 78.1% | 56/64 = 87.5% |
| Unanswerable refused | 16/16 | 16/16 |
| Answers citing a correct source | 41/50 = 82.0% | 46/56 = 82.1% |
| Fact check: confirmed / wrong / need a human / refused | 32 / 3 / 15 / 14 | 35 / 3 / 18 / 8 |

Newly answered: q01, q03, q11, q42, q44, q53, q64; newly refused: q63. Answers marked wrong by the screen: q44 (says free shipping on a $45 order), q73 (ignores that 2 hours is past the 60-minute window), q75. The 18 "need a human" answers have not been hand-checked.

## 2026-11-11, classification prompt v1 -> v2 (target: neighbouring intents and requests buried in long text)

Change: each intent gets a one-line definition (the same ten intents), plus two rules: classify the customer's current request (earlier events they mention are background), and find the one request inside long emails. No wording was copied from the eval emails.

| Metric | v1 | v2 |
|---|---|---|
| Clean emails | 39/42 = 92.9% | 40/42 = 95.2% |
| Messy emails | 10/12 = 83.3% | 11/12 = 91.7% |
| All | 49/54 = 90.7% | 51/54 = 94.4% |
| Confidence 90-100 right | 33/35 = 94.3% | 48/50 = 96.0% |
| Confidence 70-89 right | 15/18 = 83.3% | 2/3 = 66.7% |

All 5 old misses are fixed (clean #7, #15, #37, messy #4, #10). Three emails that were right are now wrong: clean #30 (payment_issue, said order_status at 100), clean #41 (unknown, said product_information at 100), messy #0 (return_exchange, said order_status at 80). Net +2 emails; with 54 emails one email is 1.9 points, so this is a small sample. The model is now more often very confident (50 of 54 at 90+, both of the wrong 90+ answers at 100), so confidence tells less than before.

## 2026-11-11, answer prompt v2 -> v3: cite every chunk used (target: answers that cite only part of the chunks they used)

Change: "Cite the ids of the chunks you used" became "Cite the id of every chunk whose facts you used, including chunks that only support part of the answer." Everything else is the same (k=5, cutoff 0.55).

| Metric | Before | After |
|---|---|---|
| Answers citing a correct source | 46/56 = 82.1% | 47/54 = 87.0% |
| Answerable answered | 56/64 = 87.5% | 54/64 = 84.4% |
| Unanswerable refused | 16/16 | 16/16 |
| Fact check: confirmed / wrong / need a human / refused | 35 / 3 / 18 / 8 | 30 / 4 / 20 / 10 |

Mixed result. The citation rate rose 4.9 points, but two answerable questions that were answered are now refused (q44, q53; q44 had a wrong answer before, so that one is an improvement), and q54 and q80 are now flagged wrong by the fact check. One run on 64 questions, so a swing of 1-2 questions is within what a small prompt change can cause. Citation misses left: q26, q35, q41, q48, q59, q64, q75; five of them are questions where retrieval did not find all needed chunks, so a prompt cannot fix them.
