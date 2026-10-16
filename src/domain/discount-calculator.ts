/**
 * Volume and loyalty discount rules used when pricing invoices.
 */
export class DiscountCalculator {
  quantityDiscount(quantity: number): number {
    if (quantity >= 100) return 0.15;
    if (quantity >= 50) return 0.10;
    if (quantity >= 10) return 0.05;
    return 0;
  }

  loyaltyDiscount(yearsAsCustomer: number): number {
    return Math.min(yearsAsCustomer * 0.01, 0.10);
  }

  combinedDiscount(quantity: number, yearsAsCustomer: number, customerType?: string | null): number {
    let discount = this.quantityDiscount(quantity) + this.loyaltyDiscount(yearsAsCustomer);

    if (customerType === 'Nonprofit') {
      discount += 0.05;
    }

    return Number(discount.toFixed(4));
  }

  applyDiscount(amount: number, discountRate: number): number {
    return Math.round(amount * (1 - discountRate) * 100) / 100;
  }
}
