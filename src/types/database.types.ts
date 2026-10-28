export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ad_accounts: {
        Row: {
          account_name: string | null
          connection_status: string
          created_at: string
          currency: string
          id: string
          last_synced_at: string | null
          organization_id: string
          provider: string
          provider_account_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          connection_status?: string
          created_at?: string
          currency?: string
          id?: string
          last_synced_at?: string | null
          organization_id: string
          provider: string
          provider_account_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          connection_status?: string
          created_at?: string
          currency?: string
          id?: string
          last_synced_at?: string | null
          organization_id?: string
          provider?: string
          provider_account_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_insights: {
        Row: {
          ad_id: string
          adset_id: string | null
          adset_name: string | null
          attribution_setting: string | null
          clicks: number
          conversions: number
          created_at: string
          currency: string
          date_start: string
          date_stop: string
          fetched_at: string
          id: string
          impressions: number
          level: string
          link_clicks: number
          organization_id: string
          reach: number
          source: string
          spend: number
          action_breakdown: Json
          conversion_action_type: string | null
          mapping_version: string
          quality_ranking: string | null
          engagement_rate_ranking: string | null
          conversion_rate_ranking: string | null
        }
        Insert: {
          ad_id: string
          adset_id?: string | null
          adset_name?: string | null
          attribution_setting?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          currency?: string
          date_start: string
          date_stop: string
          fetched_at?: string
          id?: string
          impressions?: number
          level?: string
          link_clicks?: number
          organization_id: string
          reach?: number
          source?: string
          spend?: number
          action_breakdown?: Json
          conversion_action_type?: string | null
          mapping_version?: string
          quality_ranking?: string | null
          engagement_rate_ranking?: string | null
          conversion_rate_ranking?: string | null
        }
        Update: {
          ad_id?: string
          adset_id?: string | null
          adset_name?: string | null
          attribution_setting?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          currency?: string
          date_start?: string
          date_stop?: string
          fetched_at?: string
          id?: string
          impressions?: number
          level?: string
          link_clicks?: number
          organization_id?: string
          reach?: number
          source?: string
          spend?: number
          action_breakdown?: Json
          conversion_action_type?: string | null
          mapping_version?: string
          quality_ranking?: string | null
          engagement_rate_ranking?: string | null
          conversion_rate_ranking?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_recommendation_reviews: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          recommendation_id: string
          review_note: string | null
          reviewed_by: string
          reviewer_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          recommendation_id: string
          review_note?: string | null
          reviewed_by: string
          reviewer_name?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          recommendation_id?: string
          review_note?: string | null
          reviewed_by?: string
          reviewer_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_recommendation_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          name: string
          organization_id: string
          provider_ad_id: string
          status: string
          updated_at: string
          quality_ranking: string | null
          engagement_rate_ranking: string | null
          conversion_rate_ranking: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          provider_ad_id: string
          status?: string
          updated_at?: string
          quality_ranking?: string | null
          engagement_rate_ranking?: string | null
          conversion_rate_ranking?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          provider_ad_id?: string
          status?: string
          updated_at?: string
          quality_ranking?: string | null
          engagement_rate_ranking?: string | null
          conversion_rate_ranking?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_evidence: {
        Row: {
          assessment_id: string
          created_at: string
          criterion: string
          evidence_excerpt: string | null
          evidence_status: string
          explanation: string | null
          id: string
          max_points: number
          message_id: string | null
          organization_id: string
          points_awarded: number
          score_type: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          criterion: string
          evidence_excerpt?: string | null
          evidence_status?: string
          explanation?: string | null
          id?: string
          max_points: number
          message_id?: string | null
          organization_id: string
          points_awarded: number
          score_type: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          criterion?: string
          evidence_excerpt?: string | null
          evidence_status?: string
          explanation?: string | null
          id?: string
          max_points?: number
          message_id?: string | null
          organization_id?: string
          points_awarded?: number
          score_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_evidence_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "lead_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_evidence_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attribution_events: {
        Row: {
          actor_id: string | null
          attribution_method: string
          conversation_id: string
          created_at: string
          evidence: Json
          id: string
          new_ad_id: string | null
          new_status: string
          organization_id: string
          previous_ad_id: string | null
          previous_status: string | null
          reason: string | null
          rule_version: string
        }
        Insert: {
          actor_id?: string | null
          attribution_method: string
          conversation_id: string
          created_at?: string
          evidence?: Json
          id?: string
          new_ad_id?: string | null
          new_status: string
          organization_id: string
          previous_ad_id?: string | null
          previous_status?: string | null
          reason?: string | null
          rule_version?: string
        }
        Update: {
          actor_id?: string | null
          attribution_method?: string
          conversation_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          new_ad_id?: string | null
          new_status?: string
          organization_id?: string
          previous_ad_id?: string | null
          previous_status?: string | null
          reason?: string | null
          rule_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribution_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_new_ad_id_fkey"
            columns: ["new_ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_events_previous_ad_id_fkey"
            columns: ["previous_ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ad_account_id: string
          created_at: string
          id: string
          name: string
          objective: string | null
          organization_id: string
          provider_campaign_id: string
          status: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          id?: string
          name: string
          objective?: string | null
          organization_id: string
          provider_campaign_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          id?: string
          name?: string
          objective?: string | null
          organization_id?: string
          provider_campaign_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          domisili: string | null
          id: string
          name: string | null
          organization_id: string
          phone_hash: string | null
          phone_masked: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domisili?: string | null
          id?: string
          name?: string | null
          organization_id: string
          phone_hash?: string | null
          phone_masked?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domisili?: string | null
          id?: string
          name?: string | null
          organization_id?: string
          phone_hash?: string | null
          phone_masked?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ad_id: string | null
          attribution_evidence: Json
          attribution_status: string
          channel: string
          channel_conversation_id: string | null
          contact_id: string
          created_at: string
          deduplication_id: string | null
          id: string
          last_message_at: string
          organization_id: string
          quality_label: string | null
          started_at: string
          updated_at: string
        }
        Insert: {
          ad_id?: string | null
          attribution_evidence?: Json
          attribution_status?: string
          channel?: string
          channel_conversation_id?: string | null
          contact_id: string
          created_at?: string
          deduplication_id?: string | null
          id?: string
          last_message_at?: string
          organization_id: string
          quality_label?: string | null
          started_at?: string
          updated_at?: string
        }
        Update: {
          ad_id?: string | null
          attribution_evidence?: Json
          attribution_status?: string
          channel?: string
          channel_conversation_id?: string | null
          contact_id?: string
          created_at?: string
          deduplication_id?: string | null
          id?: string
          last_message_at?: string
          organization_id?: string
          quality_label?: string | null
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          connected_by: string | null
          created_at: string
          error_message: string | null
          external_account_id: string | null
          external_account_name: string | null
          granted_scopes: string[]
          id: string
          last_synced_at: string | null
          metadata: Json
          organization_id: string
          provider: string
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          error_message?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          granted_scopes?: string[]
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          organization_id: string
          provider: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          error_message?: string | null
          external_account_id?: string | null
          external_account_name?: string | null
          granted_scopes?: string[]
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          organization_id?: string
          provider?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assessments: {
        Row: {
          buyer_score: number | null
          completed_at: string
          confidence: number | null
          conversation_id: string
          created_at: string
          id: string
          missing_information: string[]
          model_id: string
          organization_id: string
          prompt_version: string
          provider: string
          raw_assessment: Json | null
          rubric_version: string
          sales_score: number | null
          score_completeness: number
          status: string
          summary: string | null
        }
        Insert: {
          buyer_score?: number | null
          completed_at?: string
          confidence?: number | null
          conversation_id: string
          created_at?: string
          id?: string
          missing_information?: string[]
          model_id?: string
          organization_id: string
          prompt_version?: string
          provider?: string
          raw_assessment?: Json | null
          rubric_version?: string
          sales_score?: number | null
          score_completeness?: number
          status?: string
          summary?: string | null
        }
        Update: {
          buyer_score?: number | null
          completed_at?: string
          confidence?: number | null
          conversation_id?: string
          created_at?: string
          id?: string
          missing_information?: string[]
          model_id?: string
          organization_id?: string
          prompt_version?: string
          provider?: string
          raw_assessment?: Json | null
          rubric_version?: string
          sales_score?: number | null
          score_completeness?: number
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assessments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_outcomes: {
        Row: {
          conversation_id: string
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          occurred_at: string
          organization_id: string
          source: string
          stage: string
          value: number | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id: string
          source?: string
          stage: string
          value?: number | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          source?: string
          stage?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_outcomes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          message_type: string
          organization_id: string
          provider_message_id: string | null
          sender_type: string
          sent_at: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          message_type?: string
          organization_id: string
          provider_message_id?: string | null
          sender_type?: string
          sent_at?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          organization_id?: string
          provider_message_id?: string | null
          sender_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_asset_selections: {
        Row: {
          ad_account_id: string
          ad_account_name: string | null
          connected_by: string | null
          connection_status: string
          created_at: string
          id: string
          instagram_account_id: string | null
          instagram_username: string | null
          last_validated_at: string | null
          organization_id: string
          page_id: string | null
          page_name: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          ad_account_name?: string | null
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          instagram_username?: string | null
          last_validated_at?: string | null
          organization_id: string
          page_id?: string | null
          page_name?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_account_name?: string | null
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          instagram_username?: string | null
          last_validated_at?: string | null
          organization_id?: string
          page_id?: string | null
          page_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_asset_selections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_user_tokens: {
        Row: {
          created_at: string
          encrypted_access_token: string
          encryption_iv: string
          encryption_tag: string
          expires_at: string | null
          granted_scopes: string[]
          id: string
          organization_id: string
          token_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          encrypted_access_token: string
          encryption_iv: string
          encryption_tag: string
          expires_at?: string | null
          granted_scopes?: string[]
          id?: string
          organization_id: string
          token_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          encrypted_access_token?: string
          encryption_iv?: string
          encryption_tag?: string
          expires_at?: string | null
          granted_scopes?: string[]
          id?: string
          organization_id?: string
          token_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_user_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          organization_id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          organization_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      review_events: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          new_buyer_score: number | null
          new_sales_score: number | null
          organization_id: string
          previous_buyer_score: number | null
          previous_sales_score: number | null
          reason: string
          reviewer_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          new_buyer_score?: number | null
          new_sales_score?: number | null
          organization_id: string
          previous_buyer_score?: number | null
          previous_sales_score?: number | null
          reason: string
          reviewer_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          new_buyer_score?: number | null
          new_sales_score?: number | null
          organization_id?: string
          previous_buyer_score?: number | null
          previous_sales_score?: number | null
          reason?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "lead_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          diagnostic_info: Json | null
          error_code: string | null
          error_message: string | null
          id: string
          job_type: string
          organization_id: string
          provider: string
          records_processed: number
          records_rejected: number
          retry_count: number
          started_at: string | null
          status: string
          target_account_id: string | null
          time_range: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          diagnostic_info?: Json | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          organization_id: string
          provider: string
          records_processed?: number
          records_rejected?: number
          retry_count?: number
          started_at?: string | null
          status?: string
          target_account_id?: string | null
          time_range?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          diagnostic_info?: Json | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          organization_id?: string
          provider?: string
          records_processed?: number
          records_rejected?: number
          retry_count?: number
          started_at?: string | null
          status?: string
          target_account_id?: string | null
          time_range?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connection_secrets: {
        Row: {
          connection_id: string
          created_at: string
          encrypted_access_token: string
          encryption_iv: string
          encryption_tag: string
          expires_at: string | null
          id: string
          organization_id: string
          token_type: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          encrypted_access_token: string
          encryption_iv: string
          encryption_tag: string
          expires_at?: string | null
          id?: string
          organization_id: string
          token_type?: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          encrypted_access_token?: string
          encryption_iv?: string
          encryption_tag?: string
          expires_at?: string | null
          id?: string
          organization_id?: string
          token_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connection_secrets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connection_secrets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          coexistence_enabled: boolean
          connected_by: string | null
          connection_status: string
          created_at: string
          display_phone_number: string | null
          id: string
          last_webhook_received_at: string | null
          metadata: Json
          organization_id: string
          phone_number_id: string
          updated_at: string
          verified_name: string | null
          waba_id: string
        }
        Insert: {
          coexistence_enabled?: boolean
          connected_by?: string | null
          connection_status: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_webhook_received_at?: string | null
          metadata?: Json
          organization_id: string
          phone_number_id: string
          updated_at?: string
          verified_name?: string | null
          waba_id: string
        }
        Update: {
          coexistence_enabled?: boolean
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_webhook_received_at?: string | null
          metadata?: Json
          organization_id?: string
          phone_number_id?: string
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
