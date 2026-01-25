# Testing Guide

This project uses **Playwright** for End-to-End (E2E) testing and **Bun Test** for unit testing.

## Prerequisites

Ensure you have the dependencies installed:

```bash
bun install
```

## Unit Tests

Unit tests are powered by `bun test`. They locate `*.test.ts` or `*.spec.ts` files throughout the project.

### Run all unit tests

```bash
bun test
```

### Run with coverage

```bash
bun run test:coverage
```

## E2E Tests

E2E tests use **Playwright** to test the full application flow.

### Setup

Install Playwright browsers:

```bash
bunx playwright install --with-deps
```

### Run E2E tests

```bash
bun run test:e2e
```

### Run E2E tests with UI

To debug or watch tests running visually:

```bash
bun run test:e2e:ui
```

## CI/CD integration

Tests are automatically run on GitHub Actions:

- **Unit Tests**: Run on every push/PR via the `test` job.
- **E2E Tests**: Run on every push/PR via the `e2e.yml` workflow.
