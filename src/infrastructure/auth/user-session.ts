export type UserRole = 'Approver' | 'Admin' | 'Manager' | 'Director';

export interface UserSession {
  userId: string;
  username: string;
  role: UserRole;
}

export interface DemoUser {
  userId: string;
  username: string;
  password: string;
  role: UserRole;
}

export const DEMO_USERS: DemoUser[] = [
  { userId: 'usr-approver', username: 'demo.approver', password: 'ChangeMe123!', role: 'Approver' },
  { userId: 'usr-admin', username: 'demo.admin', password: 'ChangeMe123!', role: 'Admin' },
  { userId: 'usr-manager', username: 'demo.manager', password: 'ChangeMe123!', role: 'Manager' },
  { userId: 'usr-director', username: 'demo.director', password: 'ChangeMe123!', role: 'Director' },
  { userId: 'usr-director-1', username: 'demo.director1', password: 'ChangeMe123!', role: 'Director' },
  { userId: 'usr-director-2', username: 'demo.director2', password: 'ChangeMe123!', role: 'Director' },
];
