@AGENTS.md

# mailmind-rag

Handoff file for Claude Code. Written Oct 31, 2026 (about 21:00 Iran time). Read it fully before touching code.
**The repo already exists and has working code. Inspect it first. The file layout below describes intent, not a verified structure.**

## What this is
A public portfolio project by Farid Ghaderi (backend engineer, Node.js/TypeScript, ~4 years). It is evidence for Upwork clients who want "Node.js + LangGraph + RAG + LLM evaluation" work. The point is not the app, it is the **measurable eval**: baseline numbers, improvements, final numbers, regression tests.

Scenario: a fake online store, **Northwind Goods**. Customer-support emails come in. The system:
1. Classifies the email intent.
2. Retrieves relevant chunks from store policy PDFs (returns, shipping, discounts).
3. Writes a reply grounded ONLY in those chunks, with citations.
4. If retrieval is weak, refuses ("not found") and flags the email for a human.

Secondary, optional: extract fields from attachment PDFs (order confirmation/receipt). Only if time remains.

## Stack and decisions (do not revisit without asking)
- Node.js + TypeScript. **No Python** (decided; the target jobs ask for Node).
- LLM for classification and answers: **Ollama, `llama3.1:8b`**, local. Use `format: "json"` for classification.
- Embeddings: **Ollama `nomic-embed-text`** (768 dims). Prefix documents with `search_document: ` and queries with `search_query: `. **Never switch embedding models mid-project** (vectors are not comparable). Record the model name in every eval result.
- Vector store: **Postgres + pgvector** (Docker), column `vector(768)`.
- Orchestration: **LangGraph.js, added only after the baseline eval exists** (Phase 3).
- Tests: Node's built-in `node:test` run through `tsx` (`npm test`). Keep it; do not add Vitest/Jest. Development is test-first, see AGENTS.md.
- Public repo: **fake data only, no secrets, no `.env` committed.** Suggested GitHub description: "Email triage and policy Q&A pipeline in Node.js/TypeScript: classifies intent, retrieves policy chunks, answers with citations, measured by a built-in eval harness." Topics: rag, langgraph, nodejs, typescript, llm-evaluation, pgvector.

## Intents (existing, in code)
```ts
export const INTENTS = [
  'order_status', 'shipping_delivery', 'return_exchange', 'refund_status',
  'order_cancellation', 'product_information', 'damaged_defective_product',
  'payment_issue', 'discount_promotion', 'missing_incorrect_items',
] as const;
export const UNKNOWN = 'unknown';
```
Likely confusion pairs: order_status/shipping_delivery, return_exchange/refund_status, damaged_defective_product/missing_incorrect_items. Verify with a confusion matrix before changing prompts.

## Status

### Done
- Repo created, server running, Ollama running with llama3.1:8b.
- Classification endpoint works (`POST /classify`, see Code layout).
- Emails hand-labeled with an `Intent:` header in `data/classified-emails.txt`; the label is never sent to the model.
- **Run 1 saved: 39/42 = 92.9%**, llama3.1:8b, prompt v1, `results/2026-10-31-classification.json`. Misses: 7, 15, 37. Dataset is clean/easy, so this is optimistic. (42 emails are parsed; the last email in the file has no number line and is skipped.) Re-run with `npx tsx scripts/run-classification.ts`; the model is not fully repeatable even at temperature 0, so expect +-1-2 emails.
- Field renamed to `confidence` everywhere; each result is `{email, intent, confidence, accurate}`.
- PDFs are in `kb/pdf/`; `scripts/extract.ts` extracts them with pdf-parse v2 and the text is readable and in order (see Gotchas).
- Chunking done: one chunk per section, id `<doc>#<n>`, fields `{id, doc, section, text}`. Headings are detected by shape (`N. Title`, or short title-case with no digits/`$`/end punctuation). A heading with no body or only a `:` lead-in merges into the next chunk. `scripts/chunk.ts` checks every fact-sheet number appears in a chunk. Policies are tiny (sections 20-80 tokens), so there is no token target; no splitting/overlap until a doc needs it.
- 3 fact sheets saved in `kb/facts/` (contents below).
- `scripts/gen-policies.ts` generates policy Markdown via Ollama, with a number guard (strips list/heading numbers before checking that every number in the output exists in the facts). All three pass. Farid read the outputs and confirmed no invented rules.
- PDFs generated with `npx md-to-pdf kb/md/*.md` (output lands next to the .md files; move to `kb/pdf/`).

### Next (in order)
1. ~~PDF extraction~~ done.
2. ~~Chunking~~ done (`src/domain/chunkPolicy.ts`, `scripts/chunk.ts`).
3. pgvector in Docker, table with `vector(768)`, embed chunks with `search_document:` prefix, store.
4. Query embedding (`search_query:` prefix), top-k retrieval, similarity threshold for "nothing found".
5. Grounded answer prompt (use ONLY retrieved chunks, cite chunk IDs) and refusal path.
6. Wire email -> classify -> retrieve -> answer or flag. Run end to end on 5 emails.

## Milestones
| Date | Deliverable |
|------|-------------|
| Nov 3 | End-to-end pipeline works on 5 emails |
| Nov 6 | Eval set + eval script + **baseline numbers recorded** (Nov 5-6 are Farid's weekend, full days available) |
| Nov 7-10 | Improvements one at a time (eval after each), then LangGraph, regression tests, failure tests, CI |
| Nov 11 | README with architecture + before/after table + limitations; repo public; added to Upwork portfolio |
| Nov 12-14 | Case study written |

## Eval plan (Phase 2)
Datasets:
- Add about 12 **messy emails**: two intents in one, vague subject, empty body, forwarded thread.
- Q&A set: about 40 answerable questions with expected answer + source chunk, plus about 10 **unanswerable** questions (correct output is a refusal).
- Multi-chunk questions that need two policies together.

Metrics (one command writes a dated file to `results/`):
- Classification accuracy, per-intent breakdown, confusion matrix.
- Retrieval hit rate (right chunk in top-k).
- Answer correctness (manual labels first; LLM-as-judge only as a secondary check, with its limits noted).
- Refusal accuracy on unanswerable questions.
- Confidence calibration: are high-confidence classifications more often correct?

Improvement ideas for Phase 3 (apply one at a time, log before/after): one-line intent disambiguation in the prompt, chunking tweaks, hybrid search (Postgres full-text + vectors), reranking, similarity-threshold tuning, LangGraph nodes (classify, retrieve, answer, escalate).

Tests: `npm test` fails if any metric drops past a set threshold. Failure cases: empty email, Ollama down, no chunks found, malformed JSON from the model. CI runs them on push.

## Fact sheets (ground truth; the PDFs are generated from these)
Do not let any generated document add rules or numbers that are not here.

`kb/facts/returns.txt`
```
Store name: Northwind Goods
Returns accepted within 14 days of delivery
Item must be unused and in original packaging
Refunds are issued to the original payment method
Refunds take 5-7 business days after we receive the returned item
Customer pays return shipping unless the item is damaged or wrong
Damaged or wrong items: contact us within 48 hours of delivery with a photo
Exchanges are allowed for size or color, subject to stock
Sale items are final sale and cannot be returned
Refunds on discounted orders are for the amount actually paid, not the original price
```

`kb/facts/shipping.txt`
```
Store name: Northwind Goods
We ship to the United States and Canada only
Standard shipping takes 3-5 business days and costs $4.99
Express shipping takes 1-2 business days and costs $12.99
Standard shipping is free on orders over $50
Orders placed before 2 PM ship the same business day
A tracking number is emailed once the order ships
Address changes are possible within 2 hours of placing the order
If a package has not arrived 10 days after the estimated delivery date, contact us to start a lost package claim
Orders cannot be shipped to PO boxes
```

`kb/facts/discounts.txt`
```
Store name: Northwind Goods
New customers get code WELCOME10 for 10% off their first order
WELCOME10 requires a minimum order of $30
Only one discount code can be used per order
Discount codes cannot be combined with each other
Discount codes are not valid on sale items
Discount codes expire 30 days after they are issued
Newsletter subscribers receive a new code every month
If an item's price drops within 7 days of purchase, we will refund the difference on request
Gift cards cannot be used to buy other gift cards
```

## Seed Q&A test questions (start of the eval set)
| Question | Expected |
|----------|----------|
| Can I return a sale item? | No, sale items are final sale (returns) |
| Do I get free shipping on a $45 order? | No, free standard shipping needs over $50 (shipping) |
| Can I use WELCOME10 on a sale item? | No (discounts) |
| I returned something bought with a code. Which price do I get back? | The amount actually paid, not the original price (returns + discounts) |
| Do you ship to the UK? | No, US and Canada only (shipping) |
| What's your warranty on electronics? | **Not found** (unanswerable, must refuse) |
| Can I return an item after 20 days? | No, 14-day window (returns) |

## Working rules
1. Fix the order: pipeline, then baseline eval, then improvements. No LangGraph before Nov 7.
2. Every change gets an eval re-run and a log line (what changed, number before, number after).
3. New ideas go on a "later" list, not into the project.
4. Keep changes small and finish each step before the next. Do not over-polish.
5. Verify claims by running things. Report real output, including failures.

## Code layout
```
src/domain/          intents, parseEmails (header block -> subject/body/label), parseClassification, chunkPolicy
src/application/     classifyEmail (prompt + PROMPT_VERSION), classifyFile, ports (Llm, ReadFile)
src/infrastructure/  ollamaLlm, createLlm (LLM_PROVIDER/LLM_URL/LLM_MODEL), dataFileReader (confined to data/), readPdfText
src/presentation/    Express app: POST /classify {"path": "file.txt"} (relative to data/)
src/main.ts          composition root
scripts/             gen-policies, extract, chunk, run-classification
results/             dated eval outputs
```
The model is behind `Llm.complete(prompt): Promise<string>`; swapping provider/model touches only infrastructure. Email file format: number line, headers (From/To/Date/Subject/Intent) up to the first blank line, then body; emails split on `#DIVIDER#`.

## Gotchas learned
- Classification uses a **chat model** (llama3.1:8b) returning JSON labels. `nomic-embed-text` only returns vectors and cannot classify.
- Small local models wrap JSON in chatter unless `format: "json"` is set and the allowed labels are listed in the prompt.
- Small local models invent numbers and rules when writing policies; keep the number guard and read every output.
- Self-reported confidence is not accuracy. Accuracy needs hand labels.
- The `md-to-pdf` CLI writes PDFs beside the Markdown files.
- **pdf-parse is v2 (2.4.5)**: `import { PDFParse } from 'pdf-parse'`; `new PDFParse({ data: buffer })`, `await parser.getText()` -> `{ text, total }`, then `await parser.destroy()`. The old `pdf-parse/lib/pdf-parse.js` path is v1 only and fails here.
- Do not kill a dev server started with `npx` by PID; the real node process survives. Use `fuser -k <port>/tcp`.

## About the person
Farid lives in Iran; his device clock runs on London time, so ask which clock a time refers to. Weekend is Thursday and Friday; the work week starts Saturday. Weekday build window is about 2-3 hours in the evening. Hard stop at 23:30, bed by midnight. He asked to be pushed on deadlines: be direct, call out missed progress, no reassurance.
