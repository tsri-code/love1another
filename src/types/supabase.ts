/**
 * Supabase Database Type Definitions
 * 
 * This file defines the TypeScript types for the Supabase database schema.
 * It should be regenerated when the database schema changes using:
 * npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts
 * 
 * For now, we define them manually based on our schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          avatar_initials: string | null;
          avatar_color: string | null;
          encrypted_prayers: string | null;
          encryption_iv: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          avatar_initials?: string | null;
          avatar_color?: string | null;
          encrypted_prayers?: string | null;
          encryption_iv?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string;
          avatar_initials?: string | null;
          avatar_color?: string | null;
          encrypted_prayers?: string | null;
          encryption_iv?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      links: {
        Row: {
          id: string;
          profile1_id: string;
          profile2_id: string;
          link_name: string | null;
          encrypted_prayers: string | null;
          encryption_iv: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile1_id: string;
          profile2_id: string;
          link_name?: string | null;
          encrypted_prayers?: string | null;
          encryption_iv?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile1_id?: string;
          profile2_id?: string;
          link_name?: string | null;
          encrypted_prayers?: string | null;
          encryption_iv?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string;
          status: 'pending' | 'accepted' | 'rejected' | 'blocked';
          requester_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user1_id: string;
          user2_id: string;
          status?: 'pending' | 'accepted' | 'rejected' | 'blocked';
          requester_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user1_id?: string;
          user2_id?: string;
          status?: 'pending' | 'accepted' | 'rejected' | 'blocked';
          requester_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string;
          user1_key_encrypted: string;
          user2_key_encrypted: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user1_id: string;
          user2_id: string;
          user1_key_encrypted: string;
          user2_key_encrypted: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user1_id?: string;
          user2_id?: string;
          user1_key_encrypted?: string;
          user2_key_encrypted?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          encrypted_content: string;
          iv: string;
          message_type: 'message' | 'prayer_request';
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          encrypted_content: string;
          iv: string;
          message_type?: 'message' | 'prayer_request';
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          encrypted_content?: string;
          iv?: string;
          message_type?: 'message' | 'prayer_request';
          is_read?: boolean;
          created_at?: string;
        };
      };
      connections: {
        Row: {
          id: string;
          owner_user_id: string;
          profile_id: string;
          connected_user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          profile_id: string;
          connected_user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          profile_id?: string;
          connected_user_id?: string;
          created_at?: string;
        };
      };
      user_keys: {
        Row: {
          id: string;
          user_id: string;
          public_key: string;
          encrypted_private_key: string;
          key_salt: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          public_key: string;
          encrypted_private_key: string;
          key_salt: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          public_key?: string;
          encrypted_private_key?: string;
          key_salt?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      friendship_status: 'pending' | 'accepted' | 'rejected' | 'blocked';
      message_type: 'message' | 'prayer_request';
    };
  };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Link = Database['public']['Tables']['links']['Row'];
export type LinkInsert = Database['public']['Tables']['links']['Insert'];
export type LinkUpdate = Database['public']['Tables']['links']['Update'];

export type Friendship = Database['public']['Tables']['friendships']['Row'];
export type FriendshipInsert = Database['public']['Tables']['friendships']['Insert'];
export type FriendshipUpdate = Database['public']['Tables']['friendships']['Update'];

export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update'];

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

export type Connection = Database['public']['Tables']['connections']['Row'];
export type ConnectionInsert = Database['public']['Tables']['connections']['Insert'];
export type ConnectionUpdate = Database['public']['Tables']['connections']['Update'];

export type UserKeys = Database['public']['Tables']['user_keys']['Row'];
export type UserKeysInsert = Database['public']['Tables']['user_keys']['Insert'];
export type UserKeysUpdate = Database['public']['Tables']['user_keys']['Update'];

// Extended types with related data
export type ProfileWithUser = Profile & {
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
};

export type MessageWithSender = Message & {
  sender?: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
  decrypted_content?: string;
};

export type ConversationWithParticipant = Conversation & {
  participant?: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
  last_message?: Message;
  unread_count?: number;
};
