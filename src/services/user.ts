import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { hash, compare } from 'bcrypt-ts';
import { users, User, NewUser, UserRole, UserRoleType } from '../db/schema';
import { RegisterUserRequest, LoginRequest } from '../types';
import { generateUserId, isValidEmail, getCurrentTimestamp } from '../utils';

// UserService interface as defined in the design document
export interface IUserService {
  registerUser(tenantId: string, data: RegisterUserRequest): Promise<User>;
  authenticateUser(tenantId: string, credentials: LoginRequest): Promise<User | null>;
  getUserById(tenantId: string, userId: string): Promise<User | null>;
  getUserByEmail(tenantId: string, email: string): Promise<User | null>;
  validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean>;
  updateUserRole(tenantId: string, userId: string, role: UserRoleType): Promise<User>;
  updateUserLocation(tenantId: string, userId: string, locationId: string | null): Promise<User>;
  getTenantUsers(tenantId: string): Promise<User[]>;
  deleteUser(tenantId: string, userId: string): Promise<boolean>;
  changePassword(tenantId: string, userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
}

export class UserService implements IUserService {
  private readonly BCRYPT_ROUNDS = 12; // Secure default for production

  constructor(private db: DrizzleD1Database) {}

  /**
   * Register a new user with email uniqueness within tenant
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  async registerUser(tenantId: string, data: RegisterUserRequest): Promise<User> {
    // Validate input data
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    if (!data.email || !data.password) {
      throw new Error('Email and password are required');
    }

    // Validate email format
    if (!isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength (minimum requirements)
    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Validate role
    if (!Object.values(UserRole).includes(data.role)) {
      throw new Error(`Invalid role. Must be one of: ${Object.values(UserRole).join(', ')}`);
    }

    // Normalize email to lowercase
    const normalizedEmail = data.email.toLowerCase().trim();

    // Check email uniqueness within tenant (Requirement 2.1)
    const existingUser = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.email, normalizedEmail)
      ))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('A user with this email already exists in this organization');
    }

    // Hash password securely (Requirement 2.2)
    const passwordHash = await hash(data.password, this.BCRYPT_ROUNDS);

    // Create new user record
    const currentTime = getCurrentTimestamp();
    const newUser: NewUser = {
      id: generateUserId(),
      tenantId,
      email: normalizedEmail,
      passwordHash,
      role: data.role,
      locationId: data.locationId || null,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    const [createdUser] = await this.db
      .insert(users)
      .values(newUser)
      .returning();

    if (!createdUser) {
      throw new Error('Failed to create user');
    }

    return createdUser;
  }

  /**
   * Authenticate user with email and password
   * Requirements: 2.3, 2.4
   */
  async authenticateUser(tenantId: string, credentials: LoginRequest): Promise<User | null> {
    if (!tenantId || !credentials.email || !credentials.password) {
      return null;
    }

    // Normalize email
    const normalizedEmail = credentials.email.toLowerCase().trim();

    // Find user by email within tenant
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.email, normalizedEmail)
      ))
      .limit(1);

    if (!user) {
      return null; // User not found
    }

    // Validate password (Requirement 2.3)
    const isValidPassword = await this.validatePassword(credentials.password, user.passwordHash);
    
    if (!isValidPassword) {
      return null; // Invalid password
    }

    return user;
  }

  /**
   * Get user by ID within tenant context
   */
  async getUserById(tenantId: string, userId: string): Promise<User | null> {
    if (!tenantId || !userId) {
      return null;
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, userId)
      ))
      .limit(1);

    return user || null;
  }

  /**
   * Get user by email within tenant context
   */
  async getUserByEmail(tenantId: string, email: string): Promise<User | null> {
    if (!tenantId || !email) {
      return null;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.email, normalizedEmail)
      ))
      .limit(1);

    return user || null;
  }

  /**
   * Validate password against hash
   * Requirements: 2.2, 2.3
   */
  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Password validation error:', error);
      return false;
    }
  }

  /**
   * Update user role (admin operation)
   */
  async updateUserRole(tenantId: string, userId: string, role: UserRoleType): Promise<User> {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${Object.values(UserRole).join(', ')}`);
    }

    // Check if user exists in tenant
    const existingUser = await this.getUserById(tenantId, userId);
    if (!existingUser) {
      throw new Error('User not found in this organization');
    }

    // Update user role
    const [updatedUser] = await this.db
      .update(users)
      .set({ 
        role,
        updatedAt: getCurrentTimestamp(),
      })
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, userId)
      ))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update user role');
    }

    return updatedUser;
  }

  /**
   * Update user location assignment
   */
  async updateUserLocation(tenantId: string, userId: string, locationId: string | null): Promise<User> {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    // Check if user exists in tenant
    const existingUser = await this.getUserById(tenantId, userId);
    if (!existingUser) {
      throw new Error('User not found in this organization');
    }

    // Update user location
    const [updatedUser] = await this.db
      .update(users)
      .set({ 
        locationId,
        updatedAt: getCurrentTimestamp(),
      })
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, userId)
      ))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update user location');
    }

    return updatedUser;
  }

  /**
   * List all users in a tenant (admin operation)
   */
  async getTenantUsers(tenantId: string): Promise<User[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    return await this.db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId));
  }

  /**
   * Delete user (admin operation)
   */
  async deleteUser(tenantId: string, userId: string): Promise<boolean> {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    // Check if user exists in tenant
    const existingUser = await this.getUserById(tenantId, userId);
    if (!existingUser) {
      throw new Error('User not found in this organization');
    }

    const result = await this.db
      .delete(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, userId)
      ));

    return result.success;
  }

  /**
   * Change user password (requires current password verification)
   */
  async changePassword(
    tenantId: string, 
    userId: string, 
    currentPassword: string, 
    newPassword: string
  ): Promise<boolean> {
    if (!tenantId || !userId || !currentPassword || !newPassword) {
      throw new Error('All parameters are required');
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Get user
    const user = await this.getUserById(tenantId, userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.validatePassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hash(newPassword, this.BCRYPT_ROUNDS);

    // Update password
    const [updatedUser] = await this.db
      .update(users)
      .set({ 
        passwordHash: newPasswordHash,
        updatedAt: getCurrentTimestamp(),
      })
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, userId)
      ))
      .returning();

    return !!updatedUser;
  }
}

/**
 * Factory function to create UserService instance
 */
export function createUserService(db: DrizzleD1Database): IUserService {
  return new UserService(db);
}