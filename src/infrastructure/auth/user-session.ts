export type UserRole = 'Approver' | 'Admin';

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
];
