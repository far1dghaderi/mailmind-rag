# I measured a support-email AI before improving it. Four changes helped; none made answers more often correct

By Farid Ghaderi, backend engineer (Node.js, TypeScript). Code and full results: [github.com/far1dghaderi/mailmind-rag](https://github.com/far1dghaderi/mailmind-rag)

Between Nov. 6 and Nov. 11, I raised a customer-email system's intent accuracy from 90.7% to 94.4% and its retrieval of the right policy passage from 82.8% to 93.8%. The share of answers that were correct did not rise.

My hand-checked estimate went from 50 of 64 answerable questions answered correctly to 47 of 64. Wrong answers stayed at five, and the system refused four more questions than before. I kept that result in the write-up because catching it is what the evaluation was for.

## What the system does

The project, mailmind-rag, handles email for Northwind Goods, a fictional store. It classifies each email by intent, such as a return request or a shipping question.

For six policy-related intents, it searches seven policy documents, split into 45 passages, and writes an answer that cites them. Every other email, and every answer it cannot support with a passage, goes to a human.

It runs on a local 8-billion-parameter model through Ollama, with a LangGraph.js pipeline, Postgres with pgvector and an Express API.

## How I measured it

The evaluation uses 54 labeled emails, 12 of them deliberately messy, and 80 questions. Of the questions, 64 can be answered from the policies and 16 cannot.

I recorded baseline numbers on Nov. 6, before changing anything. After each change I re-ran the evaluation and logged the result. The tests fail if a saved metric drops below a set floor.

## What I changed

I made four changes, one at a time.

- **Answer prompt, version 2.** The model now decides whether the retrieved text answers the question before it writes an answer. One-word answers fell from 39 of 58 to none.
- **Retrieval settings.** The system now retrieves five passages instead of three, with a lower similarity cutoff. The right passage was found for 60 of 64 answerable questions, up from 53.
- **Classification prompt, version 2.** I added a definition for each intent. It fixed five misclassified emails and caused three new misses.
- **Answer prompt, version 3.** I asked the model to cite every passage it used. Correct citations rose from 81.0% to 87.0%.

## A change that failed first

My first attempt at the answer prompt asked only for full sentences. The model then answered questions the policies do not cover, and correct refusals fell from 16 of 16 to five of 16.

Telling the model that silence is not a "no" did not help. Having it state whether the question was answerable before writing restored 16 of 16.

## Results

| Measure | Nov. 6 | Nov. 11 |
|---|---|---|
| Intent accuracy | 90.7% | 94.4% |
| Right passage retrieved | 82.8% | 93.8% |
| Unanswerable questions refused | 16 of 16 | 16 of 16 |
| Answers citing a correct source | 81.0% | 87.0% |
| Answers of three words or fewer | 39 of 58 | 0 of 54 |
| Answers correct (estimate) | 50 of 64 | 47 of 64 |
| Answers wrong (estimate) | 5 | 5 |
| Answerable questions refused | 6 | 10 |

## Why correctness did not rise

The stricter answer check moved four answerable questions from answered to refused. The system gives fewer answers now, and the ones it gives are no more often right.

The remaining failures include comparing a number in an email with a limit in the policy. One example is a password-reset link requested 2 hours earlier against the 60-minute window the policy allows.

## Limits

The data is small and synthetic. One email moves intent accuracy by 1.9 percentage points. A local model wrote the policies and drafted the questions, and I checked them.

Each evaluation ran on one model. Repeat runs of the same configuration matched exactly.

The correctness figures rest on my hand reading of 14 answers at the baseline and 20 in the current run, plus an assumption that the answers a rule-based screen confirmed are right. They are estimates, not counts.

The model's self-reported confidence is not calibrated. After the classification change it returned 90 or higher for 50 of 54 emails.

## What is next

A reranker, a second pass that re-scores retrieved passages, is the next retrieval change on my list. The number-comparison errors are an open problem.

A continuous-integration workflow runs 115 tests on Node 20 and Node 24. The full experiment log is in `eval/experiments.md`.

## What this means for a client project

I build the measurement before the improvements. That means labeled examples, a recorded baseline, one change at a time and a re-run after each. It also means reporting results that go the wrong way, as this one did.

If your system answers customers, the evaluation is how you find out whether a change helped or only read better.
