export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'superadmin' | 'group_admin' | 'user';
  group_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  member_count?: number;
}

export interface GiftCategory {
  id: number;
  sort_order: number;
  name: string;
  short_name: string;
  core_struggle: string;
  natural_state_label: string;
  spiritual_state_label: string;
  natural_description: string | null;
  spiritual_description: string | null;
}

export interface Assessment {
  id: number;
  user_id: number;
  notes: string | null;
  completed: boolean;
  created_at: Date;
  responses?: AssessmentResponse[];
}

export interface AssessmentResponse {
  id: number;
  assessment_id: number;
  gift_category_id: number;
  score: number;
  category?: GiftCategory;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  groupId: number | null;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
