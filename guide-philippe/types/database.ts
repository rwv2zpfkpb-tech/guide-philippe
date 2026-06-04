// Hand-written types matching the migrations in supabase/migrations/.
//
// Re-generate with the Supabase CLI after schema changes:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ── spoon_rating ──────────────────────────────────────────────────────────────
// 0 = 🫗 Not Recommended
// 1 = 🥄 Remembering
// 2 = 🍴 Worth Mentioning
// 3 = 🍽️ Absolute Recommendation
export type SpoonRating = 0 | 1 | 2 | 3

export type PriceLevel = 1 | 2 | 3 | 4

// ── Database shape ────────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          role: 'user' | 'admin'
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          role?: 'user' | 'admin'
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          role?: 'user' | 'admin'
          created_at?: string
        }
      }

      restaurants: {
        Row: {
          id: string
          name: string
          google_place_id: string | null
          lat: number | null
          lng: number | null
          cuisine: string | null
          price_level: PriceLevel | null
          spoon_rating: SpoonRating
          official_review: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          google_place_id?: string | null
          lat?: number | null
          lng?: number | null
          cuisine?: string | null
          price_level?: PriceLevel | null
          spoon_rating?: SpoonRating
          official_review?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          google_place_id?: string | null
          lat?: number | null
          lng?: number | null
          cuisine?: string | null
          price_level?: PriceLevel | null
          spoon_rating?: SpoonRating
          official_review?: string | null
          created_at?: string
        }
      }

      comments: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string
          content: string
          secondary_rating: number | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          user_id: string
          content: string
          secondary_rating?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          user_id?: string
          content?: string
          secondary_rating?: number | null
          created_at?: string
        }
      }

      data_sources: {
        Row: {
          id: string
          name: string
          url: string
          freq: 'manual' | 'hourly' | 'daily' | 'weekly'
          status: 'pending' | 'syncing' | 'synced' | 'error'
          last_sync: string | null
          entry_count: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          freq?: 'manual' | 'hourly' | 'daily' | 'weekly'
          status?: 'pending' | 'syncing' | 'synced' | 'error'
          last_sync?: string | null
          entry_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          freq?: 'manual' | 'hourly' | 'daily' | 'weekly'
          status?: 'pending' | 'syncing' | 'synced' | 'error'
          last_sync?: string | null
          entry_count?: number
          created_at?: string
        }
      }
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
    }
  }
}

// ── Convenience row types ─────────────────────────────────────────────────────
export type Profile    = Database['public']['Tables']['profiles']['Row']
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type Comment    = Database['public']['Tables']['comments']['Row']
export type DataSource = Database['public']['Tables']['data_sources']['Row']

export type CommentWithProfile = Comment & {
  profiles: Pick<Profile, 'id' | 'username'>
}

export type RestaurantWithComments = Restaurant & {
  comments: CommentWithProfile[]
}
