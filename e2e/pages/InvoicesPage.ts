import { Page, Locator } from '@playwright/test';

export class InvoicesPage {
  readonly page: Page;
  readonly signOutButton: Locator;
  readonly invoicesTab: Locator;
  readonly approvalsTab: Locator;
  readonly customerInput: Locator;
  readonly amountInput: Locator;
  readonly createInvoiceButton: Locator;
  readonly createErrorAlert: Locator;
  readonly decisionErrorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signOutButton = page.getByRole('button', { name: 'Sign out' });
    this.invoicesTab = page.getByRole('tab', { name: 'Invoices' });
    this.approvalsTab = page.getByRole('tab', { name: 'Approvals' });
    this.customerInput = page.getByLabel('Customer name');
    this.amountInput = page.getByLabel('Amount');
    this.createInvoiceButton = page.getByRole('button', { name: 'Create invoice' });
    this.createErrorAlert = page.locator('#create-error');
    this.decisionErrorAlert = page.locator('#decision-error');
  }

  async selectInvoicesTab() {
    await this.invoicesTab.click();
  }

  async selectApprovalsTab() {
    await this.approvalsTab.click();
  }

  async createInvoice(customerName: string, amount: string | number) {
    await this.customerInput.fill(customerName);
    await this.amountInput.fill(String(amount));
    await this.createInvoiceButton.click();
  }

  async submitDraftForApproval(invoiceId: string) {
    await this.page
      .getByRole('button', { name: `Submit invoice ${invoiceId} for approval` })
      .click();
  }

  async approveInvoice(invoiceId: string) {
    await this.page
      .getByRole('button', { name: `Approve invoice ${invoiceId}` })
      .click();
  }

  async rejectInvoice(invoiceId: string, reason: string) {
    const reasonInput = this.page.getByLabel(`Rejection reason for ${invoiceId}`);
    if (reason) {
      await reasonInput.fill(reason);
    }
    await this.page
      .getByRole('button', { name: `Reject invoice ${invoiceId}` })
      .click();
  }

  async signOut() {
    await this.signOutButton.click();
  }
}
