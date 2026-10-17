export type Role =
  | 'CUSTOMER'
  | 'RESTAURANT_OWNER'
  | 'RESTAURANT_STAFF'
  | 'DELIVERY_STAFF'
  | 'SUPER_ADMIN';

export interface UserProfile {
  id: string;
  date_of_birth: string | null;
  gender: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  loyalty_points: number;
  total_orders: number;
  total_spent: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: Role;
  profile_picture: string | null;
  is_active: boolean;
  date_joined: string;
  profile?: UserProfile | null;
  /** Not returned by CustomUserSerializer yet: add 'email_verified' to its fields to enable the banner. */
  email_verified?: boolean;
}

/** `data` of users/login/ and users/register/ (inside the SuccessResponse envelope). */
export interface AuthPayload {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface RegisterInput {
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}
