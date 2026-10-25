import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { InvoicesPage } from '../pages/InvoicesPage';

test.describe('Invoice App Workflows', () => {
  test('User can sign in with valid credentials and sign out', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const invoicesPage = new InvoicesPage(page);

    await loginPage.goto();
    await loginPage.login('demo.approver', 'ChangeMe123!');

    await expect(page.getByText('demo.approver (Approver)', { exact: true })).toBeVisible();
    await expect(invoicesPage.invoicesTab).toBeVisible();

    await invoicesPage.signOut();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('Invalid credentials display an alert message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('demo.approver', 'WrongPassword');

    await expect(loginPage.errorAlert).toHaveText('Invalid username or password.');
  });

  test('User can create draft invoice and submit for approval', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const invoicesPage = new InvoicesPage(page);

    await loginPage.goto();
    await loginPage.login('demo.approver', 'ChangeMe123!');

    await invoicesPage.createInvoice('E2E Test Academy', 1500.50);

    // Verify invoice created in table
    const row = page.getByRole('row').filter({ hasText: 'E2E Test Academy' });
    await expect(row.getByRole('cell', { name: '$1,500.50' })).toBeVisible();

    // Submit specifically the newly created draft for approval
    const submitBtn = row.getByRole('button', { name: /Submit invoice.*for approval/ });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify status changes to Pending Approval and appears in pending list
    await invoicesPage.selectApprovalsTab();
    await expect(page.getByRole('listitem').filter({ hasText: 'E2E Test Academy' })).toBeVisible();
  });

  test('Approver can approve a pending invoice', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const invoicesPage = new InvoicesPage(page);

    await loginPage.goto();
    await loginPage.login('demo.approver', 'ChangeMe123!');

    await invoicesPage.selectApprovalsTab();
    const approveBtn = page.getByRole('button', { name: 'Approve invoice INV-1001' });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Verify it disappears from Pending Approvals
    await expect(page.getByRole('button', { name: 'Approve invoice INV-1001' })).not.toBeVisible();

    // Verify status in invoices table is Approved
    await invoicesPage.selectInvoicesTab();
    const row = page.getByRole('row').filter({ hasText: 'INV-1001' });
    await expect(row.getByRole('cell', { name: 'Approved' })).toBeVisible();
  });

  test('Approver can reject a pending invoice with reason', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const invoicesPage = new InvoicesPage(page);

    await loginPage.goto();
    await loginPage.login('demo.approver', 'ChangeMe123!');

    await invoicesPage.selectApprovalsTab();
    await invoicesPage.rejectInvoice('INV-1002', 'Disputed service charges');

    // Verify INV-1002 is removed from pending list
    await expect(page.getByRole('button', { name: 'Reject invoice INV-1002' })).not.toBeVisible();

    // Verify status in invoices table is Rejected
    await invoicesPage.selectInvoicesTab();
    const row = page.getByRole('row').filter({ hasText: 'INV-1002' });
    await expect(row.getByRole('cell', { name: 'Rejected' })).toBeVisible();
  });
});
