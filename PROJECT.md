# mailmind-rag

An email triage and policy Q&A pipeline in Node.js and TypeScript. A customer-support email comes in. The system works out what the customer wants, finds the relevant rules in the store's policy documents, and writes a reply that cites exactly where each statement came from. If it cannot find an answer in the documents, it says so and flags the email for a human instead of guessing.

Everything runs locally. There are no cloud APIs and no paid services.

## The goal

The application is not the point. **The measurement is.**

Anyone can wire an LLM to a PDF and get answers that look right. The hard part is knowing how often they are right, where they fail, and whether a change made things better or worse. This project is built around that question:

1. Build a working pipeline.
2. Measure it with a built-in eval harness and record the baseline numbers.
3. Improve it one change at a time, re-running the eval after each change.
4. Lock the results in with regression tests that fail if a metric drops.

The deliverable is a before/after table backed by real runs, not a demo.

## The scenario

A fake online store, **Northwind Goods**, receives customer-support email. Seven policy documents describe how the store works: returns, shipping and discounts, plus accounts, gift cards, pre-orders and carrier delivery. The knowledge base is deliberately big enough to contain look-alike passages (several documents talk about returns, gift cards or delivery), because a tiny one makes retrieval look better than it is. All data is invented, so the repository is safe to make public.

## What it does

For each incoming email the pipeline:

1. **Classifies the intent.** One of ten labels (`order_status`, `shipping_delivery`, `return_exchange`, `refund_status`, `order_cancellation`, `product_information`, `damaged_defective_product`, `payment_issue`, `discount_promotion`, `missing_incorrect_items`), or `unknown` when nothing fits.
2. **Retrieves** the most relevant passages from the policy PDFs.
3. **Answers using only those passages**, and cites the passage IDs it used.
4. **Refuses when retrieval is weak.** If nothing relevant is found, the output is "not found" and the email is flagged for a human.

An optional extension is extracting fields (order number, totals) from attached order confirmations or receipts.

### Why the refusal path matters

A support bot that invents a warranty policy is worse than no bot. The system is only allowed to say what the documents say. The eval includes questions the documents cannot answer (for example, "What's your warranty on electronics?") and checks that the system refuses them.

## How it works

### Classification (implemented)

The email's subject and body are joined into one string and sent to a local chat model (`llama3.1:8b` through Ollama) with a prompt that lists the allowed intents and asks for JSON. The reply is parsed, and anything outside the intent list becomes `unknown`.

Each result looks like this:

```json
{ "email": 0, "intent": "order_status", "confidence": 90, "accurate": true }
```

- `intent` is the model's answer.
- `confidence` is the number the model reports about itself (0-100). It is **self-reported certainty, not measured accuracy**. Small models are often confidently wrong, so the eval checks whether high confidence actually correlates with being right.
- `accurate` is `true` when `intent` matches the hand-written `Intent:` label on the email.

The label is read from the email's header block and is **never sent to the model**.

### Retrieval and answering (planned)

1. Policy PDFs are converted to text and split into one chunk per section (done). Each chunk keeps its document name, section heading and a stable id (`returns#3`). The policies are so short that a section is only 20-80 tokens, so there is no size target yet. A heading with no body, or only a lead-in sentence ending in `:`, is merged into the next chunk.
2. Each chunk is embedded with `nomic-embed-text` (768 dimensions) and stored in Postgres with pgvector.
3. A question is embedded the same way, and the top-k most similar chunks are retrieved. A similarity threshold decides "nothing relevant found".
4. A grounded prompt tells the model to answer only from the retrieved chunks and cite their IDs.

Embedding model rule: the model must never change mid-project, because vectors from different models are not comparable. The model name is recorded in every eval result.

### The policy documents

The PDFs are generated, but with guardrails against the model inventing rules:

1. A short plain-text **fact sheet** per policy is the ground truth (`kb/facts/`).
2. `scripts/gen-policies.ts` asks the local model to write a friendly Markdown policy from the facts. A two-way **number guard** rejects a policy that contains a number not in the fact sheet, or that drops a number the fact sheet has, and the script retries up to three times. Existing policies are never regenerated unless named on the command line, because that would change the text and shift chunk ids the eval set cites.
3. The Markdown is rendered to PDF (`kb/pdf/`).
4. A human reads every output to confirm no rules were added.

## Architecture

The code follows a layered design so the language model, the file source, and the web framework can each be swapped without touching the rest.

```
src/
  domain/          intents, email parsing, model-output parsing, answer validation, policy chunking   (no dependencies)
  application/     classification use case, prompt, ports (interfaces)
  infrastructure/  Ollama adapter, LLM factory, file reader confined to data/, PDF text reader
  presentation/    Express app: POST /classify, /triage, /triage/email, /search, /ask, static pages from public/
  main.ts          composition root, the only place everything is wired together
scripts/           gen-policies, extract (PDF text), run-classification
kb/                fact sheets, generated Markdown, PDFs
data/              sample emails
results/           dated eval outputs
```

The model is hidden behind one small interface: `complete(prompt): Promise<string>`. Output parsing lives separately in the domain layer, so changing the model, the provider, or the server changes nothing else.

### Email file format

Emails are separated by `#DIVIDER#`. Each one has a number line, a header block that ends at the first blank line, and then the body:

```
0
From: ...
To: ...
Date: ...
Intent: order_status
Subject: Order #MM10482 status

Hello, I placed order #MM10482 ...
#DIVIDER#
1
...
```

### API

**Email page:** open `/`, type or paste an email (subject and message), and press Process email (or Ctrl/Cmd+Enter). It shows the final result first, then the four stages: classify, route (can the policies answer this kind of email?), retrieve (top 3 policy sections with scores, weak ones dimmed), and answer. Skipped stages are greyed out. A few example emails can be loaded from a dropdown. `POST /triage/email` with `{ "subject": "...", "body": "..." }` returns the same data as JSON.

**Question page:** open `/question.html` and type a question. It shows the answer (or the refusal and its reason) and the top 3 chunks with similarity scores; those under the cutoff are dimmed, so you can see what the system used and what it ignored. `POST /ask` with `{ "question": "..." }` returns `{ answered, answer, citations }` or `{ answered: false, reason, flagForHuman }`, plus the search result. `POST /search` returns only the chunks.

`POST /triage` with `{ "path": "classified-emails.txt", "emails": [7, 11] }` (emails optional) runs the full pipeline and returns each email's intent, the label, and either an answer with citations or the reason it was flagged for a human.

`POST /classify` with `{ "path": "classified-emails.txt" }`. The path is relative to `data/` and cannot escape it. The response is `{ "emails": [ ... ] }` in the shape shown above.

## Stack

| Concern | Choice |
|---|---|
| Language | Node.js + TypeScript (no Python) |
| Web | Express 5 |
| Chat / classification model | Ollama, `llama3.1:8b`, JSON mode |
| Embeddings | Ollama, `nomic-embed-text` |
| Vector store | Postgres + pgvector (`vector(768)`, cosine distance) |
| Orchestration | LangGraph.js, added only after the baseline eval exists |
| PDF text | `pdf-parse` v2 |
| Tests | Node's built-in `node:test` through `tsx` |

## Evaluation

One command will run the whole eval and write a dated file to `results/`. Metrics:

- Classification accuracy, a per-intent breakdown, and a confusion matrix. Likely confusing pairs: `order_status`/`shipping_delivery`, `return_exchange`/`refund_status`, `damaged_defective_product`/`missing_incorrect_items`.
- Retrieval hit rate: is the right chunk in the top-k?
- Answer correctness, labelled by hand first. An LLM judge is a secondary check only, with its limits stated.
- Refusal accuracy on unanswerable questions.
- Confidence calibration: are high-confidence classifications more often correct?

Datasets: the labelled emails, about 12 deliberately messy ones (two intents in one, vague subject, empty body, forwarded thread), about 40 answerable questions with expected answers and source chunks, about 10 unanswerable questions, and multi-chunk questions that need two policies together.

### First end-to-end look (7 seed questions, answer prompt v1, llama3.1:8b)

Not an eval, just the first read of the pipeline. Counted by hand against the expected answers.

| Question | Result | Verdict |
|---|---|---|
| Can I return a sale item? | "no", cites `returns#4` | correct, but one word |
| Free shipping on a $45 order? | "no", cites `shipping#2` | correct, but one word |
| WELCOME10 on a sale item? | refused (`model_declined`) | wrong: retrieval dropped `discounts#2` (0.574 < 0.6) |
| Price back on a discounted return? | "the amount actually paid", cites `returns#5` | correct |
| Do you ship to the UK? | refused (`model_declined`) | wrong: `shipping#1` says US and Canada only, but the model would not infer "no" |
| Warranty on electronics? | refused (`no_relevant_chunks`) | correct refusal |
| Return after 20 days? | refused (`model_declined`) | wrong: `returns#1` says 14 days, but the model would not infer "no" |

4 of 7 right. Two kinds of failure: retrieval misses the right chunk (one case) and the model refuses when the answer needs a one-step inference (two cases). Answers are also one word because the prompt asks for a "short answer". These are the first things to improve, each measured by the eval.

### First full pipeline run (5 emails, prompt v1, llama3.1:8b)

An email goes through: classify, then (policy intents only) retrieve and answer, otherwise flag a human. The raw subject and body are the retrieval query. Only these intents are answered from the policies: `return_exchange`, `refund_status`, `shipping_delivery`, `discount_promotion`, `damaged_defective_product`, `missing_incorrect_items`. The rest (`order_status`, `order_cancellation`, `product_information`, `payment_issue`, `unknown`) need data the policies do not hold, so they are flagged.

| # | Email | Label | Model intent | Outcome | Verdict |
|---|---|---|---|---|---|
| 0 | Order #MM10482 status | order_status | order_status | flagged (intent not handled) | correct |
| 7 | Shipping cost question | shipping_delivery | order_status | flagged (intent not handled) | safe miss: misclassified, so an answerable email went to a human |
| 11 | Return window clarification | return_exchange | return_exchange | "counted from the delivery date" [`returns#1`] | correct |
| 34 | Can I combine two promotional codes? | discount_promotion | discount_promotion | "No" [`discounts#2`, `discounts#3`] | correct, but one word |
| 40 | Appointment details | unknown | unknown | flagged (intent not handled) | correct |

4 of 5 handled correctly, and the one failure is safe because it went to a human. Five emails is a smoke test, not an eval.

### Results so far

| Run | Date | Model | Prompt | Result |
|---|---|---|---|---|
| 1 | 2026-10-31 | llama3.1:8b | v1 | 39/42 = 92.9% |

The dataset is clean and easy, so this number is optimistic. Local models are also not fully repeatable even at temperature 0, so expect a difference of one or two emails between runs.

## Development approach

- **Test-first.** Every behavior starts with a failing test (see [AGENTS.md](AGENTS.md)).
- **Eval-driven.** Pipeline first, then baseline numbers, then improvements. Every change gets an eval re-run and a log line: what changed, the number before, the number after.
- **One change at a time**, so each improvement can be credited or blamed.
- **Fake data only.** No secrets and no committed `.env`.

## Running it

Requirements: Node 20+, [Ollama](https://ollama.com) with `llama3.1:8b` pulled.

```bash
npm install
cp .env.example .env                          # then set DATABASE_URL (Postgres with the pgvector extension, database `mailmind`)
npm run db:init                              # create the chunks table (these three load .env automatically)
npm run index                                # chunk, embed and store the policy PDFs
npm run ask -- "Can I return a sale item?"   # answer or refusal, plus the top 3 chunks with scores; * marks those used
npm run pipeline -- classified-emails.txt 7,11,34   # full pipeline on chosen emails (omit the numbers for all)
npx tsx scripts/check-qa.ts                  # validate eval/qa-set.json against the real chunk ids
npm run dev                                  # starts the API and the search page on http://localhost:3000 (needs .env)
npx tsx scripts/run-classification.ts        # classify data/classified-emails.txt and save to results/
npx tsx scripts/extract.ts                   # print text extracted from kb/pdf/*.pdf
npx tsx scripts/chunk.ts                     # print the chunks and check every fact-sheet number survived
npm test && npm run typecheck
```

Configuration: `DATABASE_URL` (required by the db scripts), and optionally `PORT`, `DATA_DIR`, `LLM_PROVIDER`, `LLM_URL`, `LLM_MODEL`, `EMBED_URL`, `EMBED_MODEL`. Set `TEST_DATABASE_URL` to also run the pgvector integration test.

## Progress

### Phase 1: working pipeline

- [x] Repository, Express API, layered architecture
- [x] Intent classification with local `llama3.1:8b`
- [x] Labelled email dataset (label hidden from the model)
- [x] Model call abstracted behind one interface, parsing separated from the provider
- [x] Baseline classification run saved to `results/` (Run 1, 92.9%)
- [x] Fact sheets for returns, shipping, discounts
- [x] Knowledge base extended with four more documents (accounts, gift cards, pre-orders, delivery): 45 chunks in total
- [x] Policy generation with a number guard, outputs reviewed by hand
- [x] Policy PDFs generated
- [x] PDF text extraction checked for readable, ordered text
- [x] Chunk policy text by heading, keeping document and section (one chunk per section, stable ids like `returns#3`)
- [x] Postgres + pgvector, `vector(768)` table (a local Postgres 18 instead of Docker)
- [x] Embed chunks (`search_document:` prefix) and store them (45 chunks across 7 documents, model name stored on every row)
- [x] Query embedding (`search_query:` prefix), top-k retrieval, similarity threshold (defaults k=3, threshold 0.6; to be tuned by the eval)
- [x] Grounded answer prompt with citations, and the refusal path (`POST /ask`; checks that citations are real chunks and every number comes from the question or a cited chunk)
- [x] Wire email -> classify -> retrieve -> answer or flag; run end to end on 5 emails (`POST /triage`, `npm run pipeline`)

### Phase 2: evaluation and baseline

- [ ] Add about 12 messy emails
- [x] Build the Q&A set: `eval/qa-set.json`, 80 questions (53 answerable, 11 multi-chunk, 16 unanswerable) covering all seven documents, checked by `npx tsx scripts/check-qa.ts`
- [ ] Write the one-command eval script (accuracy, confusion matrix, retrieval hit rate, answer correctness, refusal accuracy, calibration)
- [ ] Record the full baseline numbers

### Phase 3: improve and lock in

- [ ] Improvements, one at a time with an eval re-run after each (prompt disambiguation, chunking tweaks, hybrid search, reranking, threshold tuning)
- [ ] Move the pipeline into LangGraph.js (classify, retrieve, answer, escalate nodes)
- [ ] Regression tests that fail when a metric drops past a threshold
- [ ] Failure-case tests: empty email, Ollama down, no chunks found, malformed model JSON
- [ ] CI that runs the tests on push

### Phase 4: publish

- [ ] README with architecture, before/after table, and limitations
- [ ] Repository made public
- [ ] Case study written

### Optional

- [ ] Extract fields from attachment PDFs (order confirmations, receipts)

## Limitations (so far)

- Retrieval uses one fixed similarity cutoff (0.6). On the first 7 seed questions it already misses once: for "Can I use WELCOME10 on a sale item?" the chunk that holds the answer (`discounts#2`, 0.574) falls below the cutoff, while an unanswerable question's best chunk scores 0.564. One number cannot separate those two cases, so threshold tuning, hybrid search or reranking are the first improvements to try, measured by the eval.

- The labelled dataset is small and clean; the real difficulty shows up with messy emails, which are not in the dataset yet.
- `confidence` is the model's self-report and has not been calibrated.
- A small local model is not repeatable run to run.
- The policy text is generated, so the eval measures behavior on documents written by the same kind of model it is testing.
