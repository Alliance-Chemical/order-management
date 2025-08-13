# E2E Testing Guide

## Overview
This guide outlines the E2E testing architecture and best practices for the QR Workspace System. Our approach prioritizes maintainability, reliability, and avoiding technical debt.

## Architecture

### Page Object Model (POM)
We use the Page Object Model pattern to encapsulate page-specific logic and selectors:

```typescript
tests/e2e/pages/
├── BasePage.ts        # Base class with common methods
├── DashboardPage.ts   # Dashboard-specific actions
├── WorkspacePage.ts   # Workspace interactions
└── LoginPage.ts       # Authentication flows
```

### Test Data Management
Test data is centralized in fixtures for consistency:

```typescript
tests/e2e/fixtures/
├── test-data.ts       # Static test data (users, orders, etc.)
├── test-setup.ts      # Custom test fixtures and hooks
└── test-isolation.ts  # Isolation and cleanup utilities
```

## Writing Tests

### Test Structure
```typescript
import { test, expect } from './fixtures/test-setup'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup code
  })
  
  test('should perform specific action', async ({ pageObject }) => {
    // Arrange
    await pageObject.goto()
    
    // Act
    await pageObject.performAction()
    
    // Assert
    await expect(element).toBeVisible()
  })
})
```

### Best Practices

1. **Use Page Objects**: Never interact with selectors directly in tests
2. **Data Isolation**: Each test should create its own data
3. **Explicit Waits**: Use `waitForElement()` instead of arbitrary timeouts
4. **Meaningful Names**: Test names should describe the behavior being tested
5. **Single Responsibility**: Each test should verify one behavior

## Running Tests

### Local Development
```bash
# Run all tests
npm run test:e2e

# Run specific test file
npx playwright test auth.spec.ts

# Run in UI mode for debugging
npm run test:e2e:ui

# Run with specific project (browser)
npx playwright test --project=chromium
```

### CI/CD Pipeline
Tests run automatically on:
- Pull requests
- Merges to main
- Deployment to staging

### Debugging Failed Tests
1. Check screenshots in `test-results/screenshots/`
2. Review videos in `test-results/videos/`
3. Run single test in UI mode: `npx playwright test --ui`
4. Use `page.pause()` to debug interactively

## Test Categories

### Critical Path Tests
These tests cover the essential user journeys:
- Order assignment workflow
- Worker inspection flow
- Label generation
- Authentication

### Feature Tests
Specific feature validation:
- Dilution calculator
- QR scanning
- Real-time collaboration
- Grade mismatch warnings

### Visual Regression Tests
Compare UI screenshots to detect unintended changes (to be implemented).

## Maintenance

### Updating Selectors
1. Update in page object, not in tests
2. Use data-testid attributes for stability
3. Document any selector changes

### Adding New Tests
1. Identify if it's critical path or feature test
2. Create/update page objects as needed
3. Use existing test data or extend fixtures
4. Follow naming conventions
5. Run locally before committing

### Test Data Management
- Use `.env.test` for test-specific configuration
- Reset database between test runs
- Mock external APIs to avoid dependencies

## Common Patterns

### Authentication
```typescript
test.beforeEach(async ({ loginPage }) => {
  await loginPage.goto()
  await loginPage.loginAsSupervisor()
})
```

### Waiting for Elements
```typescript
await workspacePage.waitForElement('[data-testid="element"]')
```

### Handling Modals
```typescript
await page.click('button')
await page.waitForSelector('[data-testid="modal"]')
// Interact with modal
await page.click('[data-testid="modal-close"]')
await page.waitForSelector('[data-testid="modal"]', { state: 'hidden' })
```

### File Downloads
```typescript
const download = await page.waitForEvent('download')
expect(download.suggestedFilename()).toContain('.pdf')
```

## Troubleshooting

### Test Timeouts
- Increase timeout in specific test: `test.setTimeout(60000)`
- Check network conditions
- Verify test server is running

### Flaky Tests
- Add explicit waits
- Check for race conditions
- Use `test.retry()` for known intermittent issues

### Database Issues
- Ensure test database is separate from development
- Check migration status
- Verify seed data is correct

## Future Improvements
- [ ] Visual regression testing with Percy or Chromatic
- [ ] Performance testing with Lighthouse
- [ ] Accessibility testing with axe-core
- [ ] API contract testing
- [ ] Load testing for concurrent users