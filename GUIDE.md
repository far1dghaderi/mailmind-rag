# The complete guide to mailmind-rag

A walkthrough for someone who has never built an AI feature and wants to understand every part of this project: what it does, why it is built this way, what was tried, what went wrong, and what the numbers mean.

How to read it: Parts 1 to 3 give the idea and the vocabulary. Parts 4 to 6 explain the system. Parts 7 to 9 explain how it was built and measured. Parts 10 to 12 are the story and the lessons. Part 13 is a cheat sheet. If a word is new, look in the glossary in Part 2.

---

## Part 1. What this project is

### The one-paragraph version

Imagine a small online store, **Northwind Goods** (fictional; all data is invented). Customers email it with questions. Some questions can be answered from the store's written policies ("Can I return a sale item?"). Some need a person to look something up ("Where is order 10482?"). This project reads an email, works out what the customer wants, and, when the policies can answer it, writes an answer **using only the policy text and citing which passages it used**. When it cannot answer safely, it hands the email to a human instead of guessing.

### Why this exact project

The system itself is small. The point of the project is the **measurement around it**. Anyone can wire a language model to some documents and see it answer a few questions. Far fewer people can answer:

- How often is it right?
- How do you know a change made it better, not just different?
- What happens when it does not know?
- Will a future change quietly break something that worked?

So the project is built in this order: make a working pipeline, **measure it and write the numbers down (the baseline)**, improve it **one change at a time while re-measuring**, and add tests that fail if the numbers drop. The result is evidence you can show to someone who needs an AI system they can trust.

### The result in two sentences

Four changes raised intent accuracy from 90.7% to 94.4% and the rate of finding the right policy passage from 82.8% to 93.8%, and removed one-word answers entirely. The share of answers that were actually correct did not improve (an estimated 50 of 64 became 47 of 64), and the measurement is what revealed that.

---

## Part 2. Key concepts and vocabulary

Read this part once, then come back when a word is unfamiliar.

### About language models

- **LLM (large language model).** A program that predicts text. You give it a prompt; it writes a reply. It does not "look things up". It produces plausible text, which is why it can be confidently wrong.
- **Local model / Ollama.** Instead of calling a paid cloud service, I run a model on the same computer. **Ollama** is the program that does this. I use `llama3.1:8b`, a model with 8 billion parameters. It is small by today's standards, so it makes more mistakes than a large cloud model. That is useful here: mistakes are visible, and what I learn about measuring them applies to any model.
- **Prompt.** The text I send the model: the instructions, the rules, and the data. Changing the wording of a prompt can change behavior a lot. Prompts in this project are versioned (`v1`, `v2`, `v3`) so every result says which prompt produced it.
- **Temperature.** A setting for randomness. I use 0, which makes the model pick its most likely word every time. That makes results repeatable.
- **JSON output.** I ask the model to reply with structured data, for example `{"intent": "return_exchange", "confidence": 90}`, so code can read it. Models sometimes wrap it in chatter or break it, so I never trust the reply: code parses and validates it.
- **Hallucination.** When a model states something that is not true, such as an invented return window. The central risk this project guards against.

### About finding the right text (retrieval)

- **RAG (retrieval-augmented generation).** Instead of asking the model to answer from memory, first **retrieve** the relevant passages from your own documents, then ask the model to answer **only from those**. This is what stops it from making up your policies.
- **Knowledge base (KB).** The documents the system may use. Here: seven policy PDFs (returns, shipping, discounts, accounts, gift cards, pre-orders, delivery).
- **Chunk.** A piece of a document, here one section with its heading. Documents are cut into chunks because I retrieve pieces, not whole files. Each chunk has an id like `returns#3` (document and section number), so answers can cite it.
- **Embedding.** A list of numbers (768 of them here) that represents the *meaning* of a piece of text. Texts with similar meaning get similar numbers. A separate model, `nomic-embed-text`, produces them.
- **Vector and vector database.** An embedding is a vector. I store all chunk vectors in **Postgres with the pgvector extension**, which can find the stored vectors closest to a question's vector.
- **Cosine similarity.** The measure of "closeness": 1 means the same direction (very similar meaning), 0 means unrelated. Scores here typically run from about 0.4 to 0.8.
- **Top-k and cutoff.** Retrieval returns the *k* closest chunks (I use 5). A **cutoff** (I use 0.55) drops any chunk scoring lower, as "not relevant enough".
- **Document and query prefixes.** The embedding model expects `search_document: ` before chunk text and `search_query: ` before questions. The adapter adds these internally.

### About trust and safety

- **Grounded answer.** An answer that uses only facts found in the retrieved text.
- **Citation.** The answer lists the chunk ids it used, so a human can check them.
- **Refusal / flag for human.** When the system cannot answer safely, it says so and hands over. Refusing is a feature. A wrong answer sent to a customer costs more than a delayed answer.
- **Confidence.** A number from 0 to 100 that the model reports about its own certainty. It is **self-reported, not measured accuracy**, and small models are often confidently wrong.

### About measuring

- **Eval (evaluation).** A repeatable test that scores the system on examples with known correct answers.
- **Baseline.** The first set of scores, recorded before any improvement. Every later change is judged against it.
- **Labeled data.** Examples where a human wrote the correct answer: here, emails with the right intent, and questions with the right answer and the right source chunks.
- **Accuracy.** Correct answers divided by total.
- **Confusion matrix.** A table showing, for each true label, what the model said. It shows which intents get mixed up.
- **Calibration.** Whether confidence means anything: of the emails where the model said "90", were about 90% right?
- **Regression.** When a change breaks something that used to work. **Regression tests** catch this automatically.
- **Threshold (floor).** A minimum score a metric must stay above. If it drops below, a test fails.

### About how the code is built

- **TDD (test-driven development).** Write a failing test first, then the code that makes it pass. Every feature here was built this way (the project's `AGENTS.md` requires it).
- **Clean architecture.** Code is arranged in layers so business rules do not depend on tools. The model, the database and the web framework can each be replaced without touching the rest.
- **Port and adapter.** A **port** is a small interface describing what the app needs ("give me text for this prompt"). An **adapter** implements it for a specific tool (Ollama). Swapping tools means writing a new adapter.
- **Composition root.** The one file (`src/main.ts`) where everything is wired together.
- **LangGraph.** A library for building a flow as a **graph**: boxes (nodes) that each do one step, and arrows (edges) that decide what runs next.
- **CI (continuous integration).** A service that runs the tests automatically on every push. Here, GitHub Actions.

---

## Part 3. The tools, and why each was chosen

| Tool | What it does here | Why this choice |
|---|---|---|
| Node.js 20+ and TypeScript | The whole codebase | The target jobs ask for Node; no Python on purpose. TypeScript catches mistakes before running |
| Ollama with `llama3.1:8b` | Classifies emails and writes answers | Free, private, repeatable at temperature 0; weakness makes failures easy to see |
| Ollama with `nomic-embed-text` | Turns text into 768-number vectors | Local, good quality for its size. **Must never change mid-project**: vectors from different models cannot be compared, so the model name is stored with every row |
| Postgres 18 with pgvector | Stores chunks and their vectors; finds the nearest ones | A normal database with a vector extension, so there is one system to run |
| Express 5 | The web API and the two web pages | Familiar, small |
| LangGraph.js | The triage flow as a graph | The target jobs ask for it, and the graph makes the flow visible and the early exits explicit |
| `pdf-parse` v2 | Reads text out of the policy PDFs | Lets the KB be real PDFs |
| `md-to-pdf` | Renders generated Markdown policies to PDF | Produces the PDFs |
| `node:test` with `tsx` | Test runner | Built in, no extra framework |
| GitHub Actions | CI | Free, runs typecheck and tests on every push |

---

## Part 4. How one email flows through the system

### The picture

```
email
  │
  ▼
[ check ]──── empty? ─────────────────────────────┐
  │                                                │
  ▼                                                │
[ classify ]── not a policy intent? ───────────────┤
  │   (intent + confidence)                        │
  ▼                                                ▼
[ retrieve ]── no chunk above the cutoff? ──▶ [ flag for a human ]
  │   (top 5 chunks from pgvector)                 ▲
  ▼                                                │
[ answer ]──── model says "not answerable", ───────┘
  │            bad JSON, no real citation,
  ▼            or an invented number
answer + citations
```

This is the LangGraph graph in `src/application/triageGraph.ts`. There are five nodes (`check`, `classify`, `retrieve`, `answer`, `flag`). Every early exit goes to the same `flag` node.

### A worked example

The email:

> Subject: Return window
> I bought a hoodie 9 days ago and changed my mind. Can I still send it back?

1. **check.** The email is not empty, so continue.
2. **classify.** The model is shown the ten allowed intents with a one-line definition each and replies `{"intent": "return_exchange", "confidence": 95}`. `return_exchange` is one of the six intents the policies can answer, so continue.
3. **retrieve.** The email text becomes a query vector. Postgres returns the five closest chunks, each with a similarity score. Chunks scoring under 0.55 are dropped. At least one remains, so continue.
4. **answer.** The kept chunks and the question go to the model with strict rules: use only this text, decide first whether it answers the question, write one or two complete sentences, cite chunk ids. The model replies with JSON.
5. **validation.** Code checks the reply: valid JSON; `answerable` is not false; at least one cited id is one I actually supplied; every number in the answer appears in the question or a cited chunk. If any check fails, the email is flagged instead.
6. **result.** The answer, its citations and every intermediate result are returned, so the web page can show each stage.

### Why the stages are separate

Each stage can fail on its own, and the eval measures each separately. A wrong answer might come from the wrong intent, the wrong chunk, or the model misreading the right chunk. If all of that were one call, you could not tell which.

### The ten intents

`order_status`, `shipping_delivery`, `return_exchange`, `refund_status`, `order_cancellation`, `product_information`, `damaged_defective_product`, `payment_issue`, `discount_promotion`, `missing_incorrect_items`, plus `unknown` for anything that fits none.

Six of these are **policy intents**: `return_exchange`, `refund_status`, `shipping_delivery`, `discount_promotion`, `damaged_defective_product`, `missing_incorrect_items`. The policies can answer those. The other four need data the policies do not hold (an order record, a payment record, a product catalogue), so they are flagged. That choice is made in `src/domain/intents.ts`.

---

## Part 5. The architecture

### The layers

```
src/
  domain/          Pure logic. No tools, no I/O. Parsing, validation, chunking, scoring.
  application/     What the system does: use cases, prompts, the graph, the ports (interfaces).
  infrastructure/  The real tools: Ollama, Postgres, the file system, the PDF reader.
  presentation/    The Express API.
  main.ts          Wires everything together. The only file that knows all the pieces.
```

The rule: **dependencies point inward**. `domain` knows nothing about anything else. `application` knows `domain` and the ports, but not Ollama or Postgres. Only `infrastructure` and `main.ts` know the real tools.

### Why bother

I wanted the model to be swappable, so that changing the model, the provider or the server would not require changing anything else. The app depends on one tiny interface:

```ts
interface Llm { complete(prompt: string): Promise<string> }
```

To use a different model or provider, you write a new adapter and change one setting (`LLM_PROVIDER`, `LLM_URL`, `LLM_MODEL`). Parsing the model's reply lives separately in the domain layer, so the parsing rules and the inputs stay the same whatever the model is. The same idea applies to the embedder and the chunk store.

### The ports

In `src/application/ports.ts`: `Llm`, `Embedder`, `ChunkStore` and `ReadFile`. Tests replace them with tiny fakes, which is how almost everything is tested without a model or a database.

### The API and pages

`POST /classify`, `/triage`, `/triage/email`, `/search`, `/ask`, plus two pages: `/` (paste an email, see each stage and the final result) and `/question.html` (type a question, see the top chunks with scores, dimmed if under the cutoff). Inputs are validated at the edge (empty or oversized input gets a 400), and file reading is confined to the `data/` folder.

---

## Part 6. The data

An AI system is only as measurable as its data. There are three datasets.

### 6.1 The knowledge base (the policies)

Seven policies: returns, shipping, discounts, accounts, gift cards, pre-orders, delivery. They are real PDFs, but **generated**, with guardrails against the model inventing rules:

1. A short plain-text **fact sheet** per policy (`kb/facts/`) is the ground truth.
2. `scripts/gen-policies.ts` asks the local model to write friendly policy text from the facts.
3. A **number guard** (`src/domain/numberGuard.ts`) checks the result both ways: no number that is not in the fact sheet (an invented "30 days"), and no number the fact sheet had that is missing (a dropped limit). If it fails, the script retries, up to three times.
4. A human reads every output. This still caught problems the guard could not: the model once changed the meaning of a rule while keeping the numbers.
5. The Markdown is rendered to PDF (`kb/pdf/`).

The original three policies are **never regenerated**. Regenerating would change their text and shift the chunk ids the eval questions cite.

### 6.2 Chunking

`src/domain/chunkPolicy.ts` splits each policy's text into one chunk per section, keeping the document name and the section heading. A heading is detected by its shape: a numbered line, or a short title-case line with no digits or end punctuation. Two edge rules: a heading with no body, or one that ends in a colon, merges with the section after it. Chunk ids are `<document>#<number>`, and there are 45 chunks.

This took several rounds. The first rule (merge by length) was wrong; then using the title as the section was wrong; then headings with lowercase words in them were missed. Each fix was written as a failing test first, and each time the old chunks were verified to be unchanged. That matters because eval questions point at chunk ids.

### 6.3 Emails

Emails live in `data/` in a simple text format: a number line, headers, a blank line, the body, then `#DIVIDER#`. The header includes `Intent:`, the correct label.

- `classified-emails.txt`: 42 labeled emails, fairly clean.
- `messy-emails.txt`: 12 deliberately difficult ones (typos, all caps, two requests in one, a buried question, a forwarded chain, a subject that contradicts the body, mixed languages). I used a small model to draft the first versions and checked every label myself.
- `raw-emails.txt`: unlabeled, for trying the pipeline.

The parser (`src/domain/parseEmails.ts`) reads the label but **never lets it reach the model's prompt**. A test enforces that. Otherwise the model would be copying the answer.

### 6.4 The question set

`eval/qa-set.json` has 80 questions, each with an expected answer and the chunk ids that hold it. There are three types:

| Type | Count | Meaning |
|---|---|---|
| `answerable` | 53 | Any one of the listed chunks is enough |
| `multi_chunk` | 11 | All listed chunks are needed |
| `unanswerable` | 16 | The policies do not cover it. Correct behavior is refusing |

A validator (`src/domain/qaSet.ts`) rejects duplicate questions, unknown chunk ids and malformed entries. A small model drafted the first version, and I threw that draft away: it had repeated facts and weak questions. The unanswerable ones matter most. "What is your warranty on electronics?" tests whether the system refuses.

---

## Part 7. How it was built, step by step

### Phase 1: a working pipeline

1. **Scaffold.** Node and TypeScript project, tests, a rule that development is test-first.
2. **Classification API.** Read emails from a file, classify with the local model, return intent and confidence. Built first as raw Node, rebuilt in Express with the layered design when the raw version proved awkward.
3. **Model abstraction.** The `Llm` port and the factory, so the model is swappable.
4. **Accuracy fields.** Compare each prediction to the human label and report `accurate: true/false`. The model's own score is exposed as `confidence`, not "accuracy", because it is not accuracy.
5. **PDF text and chunking.** Read the PDFs, split into sections.
6. **Embedding and storage.** Embed chunks, store them in Postgres with pgvector, check the vector dimension on write.
7. **Retrieval.** Embed the question, find the nearest chunks, apply the cutoff, and show it all on a search page.
8. **Grounded answer with a refusal path.** The prompt plus code that validates the reply.
9. **Full pipeline.** Classify, then retrieve and answer for policy intents, otherwise flag. The raw email text is the retrieval query, with no rewriting step.
10. **Triage page.** A web page that shows each stage, so anyone can see why a decision was made.

### Phase 2: the eval

11. **A larger knowledge base.** Three documents made retrieval look too easy, so four more were added (accounts, gift cards, pre-orders, delivery). Look-alike passages are what make retrieval hard in reality. The result was 45 chunks.
12. **The 80-question set.**
13. **12 messy emails.**
14. **The eval scripts** and the **baseline** (recorded in Part 9).

### Phase 3: improve and lock in

15. Four improvements, one at a time, each followed by an eval run (Part 10).
16. **Failure-case tests.** Empty email, Ollama not running, no chunks found, malformed model JSON.
17. **Regression thresholds.** A test that fails when a metric drops.
18. **LangGraph.** The flow moved into a graph with behavior unchanged, checked by re-running the eval and confirming identical numbers.
19. **CI.** Typecheck and tests on every push, on Node 20 and 24.

### Phase 4: publish

20. README, case study, and a scan of the repo and its history for secrets and personal data before making it public.

---

## Part 8. The methods, in detail

### 8.1 Test-first, always

Write the failing test, watch it fail for the right reason, write the minimum code, watch it pass. About 115 tests run in a few seconds with no model and no database. The tests that need Postgres skip themselves unless a test database is configured.

One habit worth copying: **prove the safety net works**. After writing the regression test, I lowered a threshold on purpose to see it fail, and bumped a prompt version to see the "stale results" failure, then restored both.

### 8.2 Never trust the model's output

Every model reply goes through a parser before anything uses it:

- **Classification** (`parseClassification`): valid intent or `unknown`; confidence clamped to 0 to 100; garbage becomes `unknown` with confidence 0.
- **Answers** (`parseAnswer`): refuses with a named reason:

| Reason | Meaning |
|---|---|
| `no_relevant_chunks` | Retrieval found nothing above the cutoff (the model is never called) |
| `model_declined` | The model said the text does not answer the question |
| `invalid_output` | The reply was not usable JSON |
| `no_valid_citation` | It cited ids it was not given |
| `ungrounded_numbers` | The answer contains a number not in the question or the cited text |

The number rule is a cheap, strong guard against invented limits and fees.

### 8.3 Decide first, then write

The most important prompt design in the project. A model asked to "answer in a full sentence" tends to answer everything. So the model must first set `"answerable": true or false`, and the code treats `false` as a refusal even if it wrote an answer anyway. That separated the decision to answer from the wording of the answer.

### 8.4 Measure each stage separately

Retrieval can be right while the answer is wrong, and the other way round. So the eval reports retrieval hit rate, refusal accuracy, citation accuracy and answer correctness independently.

### 8.5 Sweep offline, then confirm

Instead of re-running the slow model 20 times to pick retrieval settings, `scripts/sweep-retrieval.ts` searches each question once with k=10, saves the hits, and replays 20 (k, cutoff) combinations from them. No model calls, so it takes seconds. Only the chosen setting got a full eval.

### 8.6 Keep the experiment log

`eval/experiments.md` has one entry per change: what changed, the number before, the number after, and what was learned. Failed attempts are in it too.

### 8.7 Avoid tuning on the test set

At one point a prompt example mirrored two eval questions (a UK shipping question and a 20-day return). That is **overfitting to the test**: the score goes up because the prompt memorized the exam, not because the system improved. It was removed and replaced with generic wording. The rule: write prompts the way you would if you had never seen the eval questions.

---

## Part 9. How it is evaluated

Run everything with `npm run eval` (or `npm run eval:classify` and `npm run eval:qa` separately). Each writes a dated file to `results/`.

### 9.1 Classification metrics

- **Accuracy**: correct intents over total, per file and overall.
- **Confusion matrix**: true label against predicted label.
- **Calibration**: confidence bucketed (0-49, 50-69, 70-89, 90-100) with how often each bucket was right.

### 9.2 Question-answering metrics

| Metric | Meaning |
|---|---|
| Right chunk in top-k | Is a needed chunk among the retrieved ones? (any one for `answerable`, all for `multi_chunk`) |
| Right chunk after the cutoff | Same, but only counting chunks that passed the similarity cutoff |
| Unanswerable refused | Did it correctly decline questions the policies cannot answer? |
| Answerable answered | Did it avoid refusing questions it should answer? |
| Citing a correct source | Do the cited chunks cover what was needed? |
| Answer correctness | Is the answer right? (see 9.3) |

### 9.3 Measuring answer correctness honestly

Whether an answer is correct is hard to check by code, because the expected answers are sentences. Three layers:

1. **A fact check** (`src/domain/checkFacts.ts`). A cheap screen. It marks an answer **wrong** if its yes/no is the opposite of the expected one, or all its numbers differ from the expected numbers. It marks it **confirmed** if the yes/no or a number matches. Everything else is **unchecked**. It is a screen, not a judge.
2. **A hand check.** `scripts/sample-answers.ts` writes every unchecked answer (plus a few confirmed ones) to `eval/answer-sample.md`, with the question, the expected answer and the actual answer. A person marks each as right, partly or wrong.
3. **An estimate.** Right answers = hand-read right ones + confirmed answers (assumed right; all six sampled at the baseline were). Wrong answers = hand-read wrong ones + screen-marked wrong. Refused answers counted separately. The assumptions are stated wherever the figure appears.

### 9.4 Regression thresholds

`eval/thresholds.json` holds a floor for each metric (for example, refusal rate at 100%). `src/regression.test.ts` reads the newest saved results and fails if a metric is below its floor. It also fails with "results are stale" if a prompt version or retrieval setting changed after the results were saved, which forces a re-run. It cannot run the model itself, so that check is what keeps it honest.

### 9.5 Why the numbers need care

- Each email moves accuracy by 1.9 points, because there are only 54.
- The data is synthetic, and some of it was drafted by a model.
- Results come from one model.
- Runs were repeatable at temperature 0. Q&A runs matched exactly, and classification matched across three runs, although an early classification run differed by one email.

---

## Part 10. The results and the story behind them

### The baseline (Nov. 6)

| Measure | Result |
|---|---|
| Intent accuracy (54 emails) | 49 of 54 = 90.7% (clean 92.9%, messy 83.3%) |
| Right chunk after cutoff (64 answerable) | 53 of 64 = 82.8% |
| Unanswerable refused | 16 of 16 |
| Answerable answered | 58 of 64 = 90.6% |
| Answers citing a correct source | 47 of 58 = 81.0% |
| Answers of three words or fewer | 39 of 58 |
| Answers correct (estimate) | about 50 of 64 |

### What the failures looked like

The baseline failures were sorted by cause (`eval/failure-causes.md`), which is the most useful thing to do after a baseline. Twenty failing questions fell into six groups: the right chunk missing from the top 3 (9), dropped by the cutoff (2), the model declining despite having the answer (3), comparing numbers wrongly (2), citing only some chunks (3), and answering half a two-part question (1). Five classification misses came from two causes: emails mentioning a neighbouring intent, and a real request buried in long text.

### The four changes

1. **Answer prompt v2.** *Target: one-word answers.* This took four tries (see Part 11). The version that worked made the model decide `answerable` first. One-word answers went from 39 of 58 to none, and refusals held at 16 of 16. But six answerable questions that used to be answered were now refused.
2. **Retrieval: k=5, cutoff 0.55.** *Target: missing or dropped chunks.* Right chunk found rose from 82.8% to 93.8%, and multi-chunk questions fully retrieved from 5 of 11 to 7 of 11. It also showed the cutoff barely separates answerable from unanswerable: 14 of 16 unanswerable questions already passed even 0.6.
3. **Classification prompt v2.** *Target: neighbouring intents.* A one-line definition per intent plus "classify the current request". It fixed all five old misses and caused three new ones. Accuracy 90.7% to 94.4%.
4. **Answer prompt v3.** *Target: partial citations.* "Cite every chunk you used." Correct citations 82.1% to 87.0%, with two fewer answered questions. A mixed result on one run.

### The outcome

| Measure | Baseline | After |
|---|---|---|
| Intent accuracy | 90.7% | 94.4% |
| Right chunk retrieved | 82.8% | 93.8% |
| Unanswerable refused | 16/16 | 16/16 |
| Answers citing a correct source | 81.0% | 87.0% |
| Answers of three words or fewer | 39 of 58 | 0 of 54 |
| Answers correct (estimate) | 50/64 | 47/64 |
| Answers wrong (estimate) | 5 | 5 |
| Answerable refused | 6 | 10 |

**The honest conclusion.** The changes improved how answers read, retrieval, citations and classification. They did not improve correctness: four more answerable questions moved from answered to refused, and wrong answers stayed at five. The stricter gate trades coverage for safety. The difference is three questions out of 64, so "did not improve" is accurate and "got worse" would overstate it.

This is the real value of the eval. Without it, the improvements would have looked like a clean win.

---

## Part 11. Problems I hit and how they were solved

This section is the most useful one for a newcomer, because these are normal problems.

### Prompts

- **Asking for full sentences broke refusals.** Variants tried: allow inference plus sentences (refusals 7 of 16); add "silence is not a no" (5 of 16); sentences only (5 of 16). The model ignored the instruction. What worked was a structural change: a separate `answerable` field read by code (16 of 16). **Lesson: if a prompt instruction is being ignored, change the structure, not the wording.**
- **A prompt mirrored the test.** See 8.7.
- **A misleading field name.** The number the model reports about itself was first called "accuracy". It is not accuracy, so it is named `confidence`, and a separate `accurate` field compares each prediction with the human label.

### Data

- **The model changed policy meaning while keeping numbers.** Fixed with the two-way number guard, retries, tighter prompts, a human read of every output, and one hand-added line in the accounts policy.
- **A fact-sheet contradiction.** One sheet said a gift card could buy "any product" while another said gift cards cannot buy gift cards. Narrowed to "merchandise".
- **The first question set was weak.** Repeated facts and unclear questions, so it was replaced.
- **Three documents were too easy.** Look-alike passages appear only when several documents discuss similar things. Extending the KB to seven documents added realistic distractors (a pre-order passage started outranking the returns passage for "can I return a sale item?").
- **A hub chunk.** One gift-card passage matches many questions because it is generic. It shows up as a distractor in top-k and is a reason retrieval cannot be fixed by the cutoff alone.

### Code and tooling

- **Missing `process` type in TypeScript.** Fixed by adding `"types": ["node"]`.
- **Test glob failed on Node 20.** The `--test` glob was not expanded, so the test script uses `find`.
- **`pdf-parse` import failed.** It was a v1 import path; v2 uses a `PDFParse` class.
- **The chunker needed three rounds.** Each fixed test-first, with old chunk ids verified unchanged.
- **Database password errors.** `SASL: password must be a string`. Fixed with a clear error from `createPool()`, `--env-file=.env` in npm scripts, and a password-free `.env` plus a `~/.pgpass` file.
- **A stale server held a port, and `pkill -f` killed its own shell.** Fixed with `fuser -k <port>/tcp`.
- **Throwaway scripts.** Top-level `await` needs `.mts`, and scripts must run from the repo so `pg` resolves.
- **Ollama down gave a useless "fetch failed" and a 500.** Found by writing the failure-case tests. Fixed with a shared helper that returns a 503 "Ollama is not reachable at ..." and a clear error for an odd reply.
- **A test and code written together once.** Noted and not repeated.

### Process and publishing

- **The retrieval cutoff was a guess.** Chosen from 7 questions at first. The offline sweep replaced the guess with evidence.
- **Pushes timed out repeatedly** and then succeeded. Not a code problem.

---

## Part 12. Lessons for someone doing this the first time

1. **Build the measurement before the improvements.** Without a baseline, you cannot say anything was better.
2. **Measure each stage separately.** Retrieval, the decision to answer, the wording, and the citations fail in different ways.
3. **Make refusing a first-class outcome.** Include questions the system cannot answer, and measure that it declines them.
4. **Never trust model output.** Parse it, validate it, and have named failure reasons.
5. **Change one thing at a time.** Otherwise you cannot tell what helped.
6. **Prompt wording is weak, structure is strong.** If the model ignores an instruction, give it a field to fill in that code checks.
7. **Do not tune on your test.** Write prompts as if you had not seen the questions.
8. **Read the failures.** Sorting them by cause tells you what to fix and in what order.
9. **Cheap checks first, humans where it counts.** A fact check cuts the reading load, and a person reads the rest. State the assumptions.
10. **Report results that go the wrong way.** A result that goes the wrong way is the evidence that the evaluation works.
11. **Keep the model swappable.** Models change faster than everything else.
12. **Test the safety net.** Break something on purpose and watch the test fail.

---

## Part 13. Reference

### Run it

You need Node 20+, Ollama, and Postgres with the pgvector extension.

```bash
ollama pull llama3.1:8b
ollama pull nomic-embed-text
npm install
cp .env.example .env     # set DATABASE_URL
npm run db:init          # create the chunks table
npm run index            # chunk the PDFs, embed, store
npm run dev              # http://localhost:3000
```

### Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests plus the regression test (about 115 tests) |
| `npm run typecheck` | TypeScript check |
| `npm run eval` | Classification and Q&A evals; writes `results/` |
| `npm run eval:classify` / `npm run eval:qa` | One eval at a time |
| `npm run ask -- "question"` | Ask one question from the command line |
| `npm run pipeline` | Run the full pipeline on the sample emails |
| `npx tsx scripts/check-qa.ts` | Validate the question set against real chunk ids |
| `npx tsx --env-file=.env scripts/sweep-retrieval.ts` | Compare retrieval settings offline |
| `npx tsx scripts/sample-answers.ts <results file>` | Write the answers to hand-check |

### Environment variables

`DATABASE_URL` (required to run), `TEST_DATABASE_URL` (optional, enables database tests), `LLM_PROVIDER`, `LLM_URL`, `LLM_MODEL`, `EMBED_URL`, `EMBED_MODEL`, `PORT`.

### Where things are

| You want to... | Look at |
|---|---|
| Change the answer prompt | `src/application/answerQuestion.ts` (bump `ANSWER_PROMPT_VERSION`) |
| Change the classification prompt | `src/application/classifyEmail.ts` (bump `PROMPT_VERSION`) |
| Change retrieval settings | `src/application/retrieve.ts` (`RETRIEVAL_DEFAULTS`) |
| Change the flow | `src/application/triageGraph.ts` |
| Change what counts as a valid answer | `src/domain/parseAnswer.ts` |
| Change the metric floors | `eval/thresholds.json` |
| Add eval questions | `eval/qa-set.json`, then run `check-qa.ts` |
| See every experiment | `eval/experiments.md` |
| See why things failed | `eval/failure-causes.md` |
| See the saved numbers | `results/` |

### After you change a prompt

1. Write a failing test, make it pass.
2. Bump the prompt version.
3. Run `npm run eval`.
4. Compare to the last numbers, and read what changed, not just the totals.
5. Add an entry to `eval/experiments.md`.
6. Commit the new `results/` files, so the regression test and CI see them.

### What to do next

- **A reranker.** A second pass that re-scores retrieved chunks against the question. The most likely fix for the retrieval misses and the weak cutoff.
- **The number-comparison errors.** The model sometimes fails to compare a number in the email with a limit in the policy (2 hours against a 60-minute window). That calls for a different approach than prompt wording.
- **Fewer over-refusals.** Ten answerable questions are refused.
- **More and different data.** A larger, real-world email set, and a larger model, to see which findings still hold.
- **Receipt and attachment extraction.** Not built.
- **Compile the graph once.** It is rebuilt on every request, and that is cheap but wasteful.

### Related files

- [README.md](README.md): the short version, with the results table.
- [CASE_STUDY.md](CASE_STUDY.md): the story written for a non-technical reader.
- [PROJECT.md](PROJECT.md): the original plan and progress checklist.
- [eval/experiments.md](eval/experiments.md), [eval/failure-causes.md](eval/failure-causes.md): the evidence.
