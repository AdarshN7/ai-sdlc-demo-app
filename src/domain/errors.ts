import type { ApprovalRejectionReason } from './approval-limits';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends DomainError {}
export class ConflictError extends DomainError {}
export class ValidationError extends DomainError {}
export class UnauthorizedError extends DomainError {}
export class ForbiddenError extends DomainError {}

export class ApprovalRejectedError extends DomainError {
  constructor(
    public readonly reason: ApprovalRejectionReason,
    message: string
  ) {
    super(message);
  }
}

