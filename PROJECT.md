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

A fake online store, **Northwind Goods**, receives customer-support email. Three policy documents (returns, shipping, discounts) describe how the store works. All data is invented, so the repository is safe to make public.

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
2. `scripts/gen-policies.ts` asks the local model to write a friendly Markdown policy from the facts. A **number guard** checks that every number in the output appears in the fact sheet.
3. The Markdown is rendered to PDF (`kb/pdf/`).
4. A human reads every output to confirm no rules were added.

## Architecture

The code follows a layered design so the language model, the file source, and the web framework can each be swapped without touching the rest.

```
src/
  domain/          intents, email parsing, model-output parsing, policy chunking   (no dependencies)
  application/     classification use case, prompt, ports (interfaces)
  infrastructure/  Ollama adapter, LLM factory, file reader confined to data/, PDF text reader
  presentation/    Express app: POST /classify
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
npx tsx scripts/db-init.ts                   # create the chunks table
npx tsx scripts/index-kb.ts                  # chunk, embed and store the policy PDFs
npm run dev                                  # starts the API on :3000
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
- [x] Policy generation with a number guard, outputs reviewed by hand
- [x] Policy PDFs generated
- [x] PDF text extraction checked for readable, ordered text
- [x] Chunk policy text by heading, keeping document and section (one chunk per section, stable ids like `returns#3`)
- [x] Postgres + pgvector, `vector(768)` table (a local Postgres 18 instead of Docker)
- [x] Embed chunks (`search_document:` prefix) and store them (21 chunks, model name stored on every row)
- [ ] Query embedding (`search_query:` prefix), top-k retrieval, similarity threshold
- [ ] Grounded answer prompt with citations, and the refusal path
- [ ] Wire email -> classify -> retrieve -> answer or flag; run end to end on 5 emails

### Phase 2: evaluation and baseline

- [ ] Add about 12 messy emails
- [ ] Build the Q&A set: about 40 answerable, about 10 unanswerable, plus multi-chunk questions
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

- The labelled dataset is small and clean; the real difficulty shows up with messy emails, which are not in the dataset yet.
- `confidence` is the model's self-report and has not been calibrated.
- A small local model is not repeatable run to run.
- The policy text is generated, so the eval measures behavior on documents written by the same kind of model it is testing.
