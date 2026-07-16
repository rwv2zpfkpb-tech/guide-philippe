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

export type PriceLevel = 0 | 1 | 2 | 3 | 4

// ── restaurants.status ────────────────────────────────────────────────────────
// 'published' = für alle approved Nutzer sichtbar (Standard)
// 'draft'     = nur im Admin-Dashboard sichtbar, für normale Nutzer per RLS gesperrt
export type RestaurantStatus = 'draft' | 'published'

// ── profiles.status ────────────────────────────────────────────────────────────
// 'pending'  = registriert, wartet auf Admin-Freischaltung (kein Zugriff außer /pending)
// 'approved' = freigeschaltet, voller Zugriff gemäß role
// 'rejected' = von Admin abgelehnt, kein Zugriff
export type ProfileStatus = 'pending' | 'approved' | 'rejected'

// ── review categories ────────────────────────────────────────────────────────
// Fixed set of sub-categories an editorial review can optionally break down into.
export type ReviewCategory = 'service' | 'location' | 'geschmack' | 'preis_leistung'

// ── Database shape ────────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          role: 'user' | 'admin'
          status: ProfileStatus
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          role?: 'user' | 'admin'
          status?: ProfileStatus
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          role?: 'user' | 'admin'
          status?: ProfileStatus
          created_at?: string
        }
        Relationships: []
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
          status: RestaurantStatus
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
          status?: RestaurantStatus
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
          status?: RestaurantStatus
          created_at?: string
        }
        Relationships: []
      }

      // restaurant_reviews: ein redaktioneller Aufenthalt/Review.
      // restaurants.spoon_rating wird per DB-Trigger immer aus dem Review mit
      // dem höchsten (visited_at, created_at) für dieses Restaurant synchronisiert.
      restaurant_reviews: {
        Row: {
          id: string
          restaurant_id: string
          visited_at: string
          spoon_rating: SpoonRating
          fazit: string
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          visited_at?: string
          spoon_rating: SpoonRating
          fazit?: string
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          visited_at?: string
          spoon_rating?: SpoonRating
          fazit?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          }
        ]
      }

      // restaurant_review_categories: bis zu 4 optionale Unterbewertungen je Review
      // (Service/Location/Geschmack/Preis-Leistung), je 0–5, unique je (review_id, category).
      restaurant_review_categories: {
        Row: {
          id: string
          review_id: string
          category: ReviewCategory
          heading: string | null
          body: string | null
          rating: number | null
        }
        Insert: {
          id?: string
          review_id: string
          category: ReviewCategory
          heading?: string | null
          body?: string | null
          rating?: number | null
        }
        Update: {
          id?: string
          review_id?: string
          category?: ReviewCategory
          heading?: string | null
          body?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_review_categories_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "restaurant_reviews"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "comments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_approved: { Args: Record<string, never>; Returns: boolean }
    }
  }
}

// ── Convenience row types ─────────────────────────────────────────────────────
export type Profile                  = Database['public']['Tables']['profiles']['Row']
export type Restaurant               = Database['public']['Tables']['restaurants']['Row']
export type Comment                  = Database['public']['Tables']['comments']['Row']
export type DataSource               = Database['public']['Tables']['data_sources']['Row']
export type RestaurantReview         = Database['public']['Tables']['restaurant_reviews']['Row']
export type RestaurantReviewCategory = Database['public']['Tables']['restaurant_review_categories']['Row']

export type CommentWithProfile = Comment & {
  profiles: Pick<Profile, 'id' | 'username'>
}

export type ReviewWithCategories = RestaurantReview & {
  categories: RestaurantReviewCategory[]
}

export type RestaurantWithComments = Restaurant & {
  comments: CommentWithProfile[]
  reviews: ReviewWithCategories[]
}
