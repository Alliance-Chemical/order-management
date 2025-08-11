# Testing Guide for Workspace Order Management System

## Overview
This testing suite provides comprehensive coverage for the Workspace Order Management System using:
- **Vitest** for unit and integration tests
- **Playwright** for end-to-end tests
- **React Testing Library** for component tests

## Quick Start

### Running Tests

```bash
# Run all tests once
npm run test:all

# Run unit/integration tests
npm test                # Watch mode
npm run test:run        # Run once
npm run test:ui         # Open Vitest UI
npm run test:coverage   # Generate coverage report

# Run E2E tests
npm run test:e2e        # Run Playwright tests
npm run test:e2e:ui     # Open Playwright UI
npm run test:e2e:debug  # Debug mode
```

## Test Database Setup

Before running integration tests, you need to set up a test database:

1. Create a new database in Neon specifically for testing
2. Update `.env.test` with your test database connection string:
   ```
   DATABASE_URL="postgres://your-test-database-connection-string"
   ```

## Test Structure

### Unit & Integration Tests (`/tests/` and `*.test.ts` files)

#### API Route Tests
Location: `app/api/**/route.test.ts`
- Tests API endpoints with real database interactions
- Uses test database to avoid polluting production data
- Example: Workspace API, QR code generation, webhook handlers

#### Service Tests
Location: `lib/services/**/*.test.ts`
- Tests business logic in isolation
- Mocks external dependencies (APIs, databases)
- Example: GeminiService with mocked AI responses

### E2E Tests (`/tests/e2e/`)

#### Golden Path Workflow
Location: `tests/e2e/full-order-workflow.spec.ts`
- Tests complete user journey from order creation to inspection completion
- Simulates both desktop and mobile interactions
- Verifies database state changes

## Test Helpers

### Database Helpers (`tests/helpers/db.ts`)
```typescript
// Create test database connection
const testDb = createTestDb()

// Seed test data
const workspace = await seedTestWorkspace(testDb, 'ORDER-123')

// Clean up after tests
await cleanupTestDb(testDb)
```

## Writing New Tests

### API Integration Test Template
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, POST } from './route'
import { createTestDb, cleanupTestDb, seedTestWorkspace } from '@/tests/helpers/db'

describe('/api/your-endpoint', () => {
  let testDb: ReturnType<typeof createTestDb>
  
  beforeEach(() => {
    testDb = createTestDb()
  })
  
  afterEach(async () => {
    await cleanupTestDb(testDb)
  })

  it('should handle request correctly', async () => {
    // Arrange: Set up test data
    await seedTestWorkspace(testDb)
    
    // Act: Make request
    const response = await GET(request, { params })
    
    // Assert: Verify response
    expect(response.status).toBe(200)
  })
})
```

### E2E Test Template
```typescript
import { test, expect } from '@playwright/test'

test('user workflow description', async ({ page }) => {
  // Navigate to page
  await page.goto('/path')
  
  // Interact with elements
  await page.click('button:has-text("Action")')
  
  // Assert results
  await expect(page.locator('.result')).toBeVisible()
})
```

## Mocking External Services

### Mocking Gemini AI
```typescript
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: vi.fn().mockReturnValue('{"result": "mocked"}') }
      })
    })
  }))
}))
```

### Mocking AWS Services
```typescript
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn()
}))
```

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:run
      - run: npx playwright install
      - run: npm run test:e2e
```

## Debugging Tests

### Vitest Debugging
1. Use `npm run test:ui` to open the Vitest UI
2. Click on failing tests to see detailed error messages
3. Use `console.log()` in tests for debugging

### Playwright Debugging
1. Use `npm run test:e2e:debug` to run in debug mode
2. Use `page.pause()` to pause execution
3. Use Playwright Inspector to step through tests

## Coverage Reports

Generate and view coverage reports:
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

## Common Issues & Solutions

### Issue: Tests fail with database connection errors
**Solution**: Ensure `.env.test` has correct database URL and the test database exists

### Issue: E2E tests timeout
**Solution**: Increase timeout in playwright.config.ts or specific test:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000) // 60 seconds
  // test code
})
```

### Issue: Mocked modules not working
**Solution**: Clear module cache before mocking:
```typescript
vi.resetModules()
vi.mock('module-name', () => ({ /* mock */ }))
```

## Best Practices

1. **Isolate Tests**: Each test should be independent and not rely on others
2. **Clean Up**: Always clean up test data in `afterEach` hooks
3. **Mock External Services**: Don't make real API calls in tests
4. **Use Test IDs**: Add `data-testid` attributes for E2E test selectors
5. **Test User Behavior**: Focus on what users do, not implementation details
6. **Keep Tests Fast**: Mock slow operations, use test database
7. **Write Descriptive Names**: Test names should explain what they test

## Next Steps

1. Set up your test database in Neon
2. Update `.env.test` with connection string
3. Run `npm test` to start testing
4. Add tests as you develop new features