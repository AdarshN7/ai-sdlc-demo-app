export type UserRole = 'Approver' | 'Admin' | 'Manager' | 'Director';

export interface UserSession {
  username: string;
  role: UserRole;
}

export interface DemoUser {
  username: string;
  password: string;
  role: UserRole;
}

export const DEMO_USERS: DemoUser[] = [
  { username: 'demo.approver', password: 'ChangeMe123!', role: 'Approver' },
  { username: 'demo.admin', password: 'ChangeMe123!', role: 'Admin' },
  { username: 'demo.manager', password: 'ChangeMe123!', role: 'Manager' },
  { username: 'demo.director', password: 'ChangeMe123!', role: 'Director' },
  { username: 'demo.director1', password: 'ChangeMe123!', role: 'Director' },
  { username: 'demo.director2', password: 'ChangeMe123!', role: 'Director' },
];
