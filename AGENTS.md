# AGENTS.md

## Development approach

This project is developed test-first (TDD):

1. Write a failing test for the behavior first (`src/**/*.test.ts`, `node:test`).
2. Write the minimum code to make it pass.
3. Refactor with the tests green.

Run `npm test` and `npm run typecheck` before considering any change done.
