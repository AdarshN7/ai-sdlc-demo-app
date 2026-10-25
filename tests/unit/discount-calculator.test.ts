import { describe, it, expect } from 'vitest';
import { DiscountCalculator } from '@/domain/discount-calculator';

describe('DiscountCalculator', () => {
  const calc = new DiscountCalculator();

  it('calculates quantity discount tiers', () => {
    expect(calc.quantityDiscount(150)).toBe(0.15);
    expect(calc.quantityDiscount(100)).toBe(0.15);
    expect(calc.quantityDiscount(75)).toBe(0.10);
    expect(calc.quantityDiscount(50)).toBe(0.10);
    expect(calc.quantityDiscount(20)).toBe(0.05);
    expect(calc.quantityDiscount(10)).toBe(0.05);
    expect(calc.quantityDiscount(5)).toBe(0);
  });

  it('calculates loyalty discount capped at 10%', () => {
    expect(calc.loyaltyDiscount(3)).toBe(0.03);
    expect(calc.loyaltyDiscount(10)).toBe(0.10);
    expect(calc.loyaltyDiscount(15)).toBe(0.10);
  });

  it('calculates combined discount with optional nonprofit bonus', () => {
    expect(calc.combinedDiscount(50, 5, 'Commercial')).toBe(0.15);
    expect(calc.combinedDiscount(50, 5, 'Nonprofit')).toBe(0.20);
  });

  it('applies discount correctly with rounding', () => {
    expect(calc.applyDiscount(100, 0.10)).toBe(90.00);
    expect(calc.applyDiscount(99.99, 0.15)).toBe(84.99);
  });
});
