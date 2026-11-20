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
      ad_scrape_jobs: {
        Row: {
          id: string
          user_id: string | null
          organization_id: string | null
          search_keyword: string
          country_code: string | null
          status: string
          total_ads_found: number | null
          error_message: string | null
          created_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          search_keyword: string
          country_code?: string | null
          status?: string
          total_ads_found?: number | null
          error_message?: string | null
          created_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          search_keyword?: string
          country_code?: string | null
          status?: string
          total_ads_found?: number | null
          error_message?: string | null
          created_at?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      scraped_competitor_ads: {
        Row: {
          id: string
          user_id: string | null
          organization_id: string | null
          scrape_job_id: string | null
          ad_archive_id: string
          search_keyword: string
          page_id: string
          page_name: string
          page_profile_uri: string | null
          is_active: boolean | null
          start_date: string
          end_date: string | null
          active_days_count: number
          longevity_phase: string
          collation_id: string | null
          collation_count: number | null
          media_format: string
          cos_media_urls: Json
          original_body_text: string | null
          headline_title: string | null
          link_description: string | null
          cta_type: string | null
          cta_text: string | null
          destination_url: string | null
          funnel_type: string
          decoded_wa_number: string | null
          decoded_wa_text: string | null
          destination_domain: string | null
          publisher_platforms: string[] | null
          ai_analysis: Json | null
          ai_analyzed_at: string | null
          scraped_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          scrape_job_id?: string | null
          ad_archive_id: string
          search_keyword: string
          page_id: string
          page_name: string
          page_profile_uri?: string | null
          is_active?: boolean | null
          start_date: string
          end_date?: string | null
          active_days_count?: number
          longevity_phase?: string
          collation_id?: string | null
          collation_count?: number | null
          media_format: string
          cos_media_urls?: Json
          original_body_text?: string | null
          headline_title?: string | null
          link_description?: string | null
          cta_type?: string | null
          cta_text?: string | null
          destination_url?: string | null
          funnel_type?: string
          decoded_wa_number?: string | null
          decoded_wa_text?: string | null
          destination_domain?: string | null
          publisher_platforms?: string[] | null
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          scraped_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          scrape_job_id?: string | null
          ad_archive_id?: string
          search_keyword?: string
          page_id?: string
          page_name?: string
          page_profile_uri?: string | null
          is_active?: boolean | null
          start_date?: string
          end_date?: string | null
          active_days_count?: number
          longevity_phase?: string
          collation_id?: string | null
          collation_count?: number | null
          media_format?: string
          cos_media_urls?: Json
          original_body_text?: string | null
          headline_title?: string | null
          link_description?: string | null
          cta_type?: string | null
          cta_text?: string | null
          destination_url?: string | null
          funnel_type?: string
          decoded_wa_number?: string | null
          decoded_wa_text?: string | null
          destination_domain?: string | null
          publisher_platforms?: string[] | null
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          scraped_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_autonomous_logs: {
        Row: {
          action_taken: string
          entity_id: string
          entity_type: string
          error_message: string | null
          executed_at: string
          id: string
          new_state: Json | null
          organization_id: string
          previous_state: Json | null
          reason: string
          recommendation_id: string | null
          status: string
        }
        Insert: {
          action_taken: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          executed_at?: string
          id?: string
          new_state?: Json | null
          organization_id: string
          previous_state?: Json | null
          reason: string
          recommendation_id?: string | null
          status?: string
        }
        Update: {
          action_taken?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          executed_at?: string
          id?: string
          new_state?: Json | null
          organization_id?: string
          previous_state?: Json | null
          reason?: string
          recommendation_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_autonomous_logs_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_account_insights: {
        Row: {
          id: string
          organization_id: string
          ad_account_id: string
          date_start: string
          date_stop: string
          impressions: number | null
          reach: number | null
          frequency: number | null
          currency: string | null
          source: string
          fetched_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ad_account_id: string
          date_start: string
          date_stop: string
          impressions?: number | null
          reach?: number | null
          frequency?: number | null
          currency?: string | null
          source?: string
          fetched_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          ad_account_id?: string
          date_start?: string
          date_stop?: string
          impressions?: number | null
          reach?: number | null
          frequency?: number | null
          currency?: string | null
          source?: string
          fetched_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ad_account_insights_account_org"
            columns: ["ad_account_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "ad_account_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          account_name: string | null
          connection_status: string
          created_at: string
          currency: string | null
          id: string
          last_synced_at: string | null
          organization_id: string
          provider: string
          provider_account_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          connection_status?: string
          created_at?: string
          currency?: string | null
          id?: string
          last_synced_at?: string | null
          organization_id: string
          provider: string
          provider_account_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          connection_status?: string
          created_at?: string
          currency?: string | null
          id?: string
          last_synced_at?: string | null
          organization_id?: string
          provider?: string
          provider_account_id?: string
          timezone?: string | null
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
          currency: string | null
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
          cost_per_action_type: Json
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
          currency?: string | null
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
          cost_per_action_type?: Json
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
          currency?: string | null
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
          cost_per_action_type?: Json
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
      capi_dispatch_logs: {
        Row: {
          created_at: string
          ctwa_clid_masked: string | null
          error_message: string | null
          event_id: string
          event_name: string
          http_status: number | null
          id: string
          lead_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ctwa_clid_masked?: string | null
          error_message?: string | null
          event_id: string
          event_name: string
          http_status?: number | null
          id?: string
          lead_id: string
          status: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          ctwa_clid_masked?: string | null
          error_message?: string | null
          event_id?: string
          event_name?: string
          http_status?: number | null
          id?: string
          lead_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capi_dispatch_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capi_dispatch_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          campaign_id: string | null
          capi_event_id: string | null
          capi_sync_status: string | null
          capi_synced_at: string | null
          channel: string
          channel_conversation_id: string | null
          connection_id: string | null
          contact_id: string | null
          created_at: string
          customer_name: string | null
          customer_wa_id: string | null
          deduplication_id: string | null
          first_message_at: string | null
          first_response_time_seconds: number | null
          id: string
          last_ai_analyzed_at: string | null
          last_message_at: string
          last_prospect_message_at: string | null
          last_sales_echo_at: string | null
          needs_ai_analysis: boolean
          organization_id: string | null
          quality_label: string | null
          source_type: string
          started_at: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ad_id?: string | null
          attribution_evidence?: Json
          attribution_status?: string
          campaign_id?: string | null
          capi_event_id?: string | null
          capi_sync_status?: string | null
          capi_synced_at?: string | null
          channel?: string
          channel_conversation_id?: string | null
          connection_id?: string | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_wa_id?: string | null
          deduplication_id?: string | null
          first_message_at?: string | null
          first_response_time_seconds?: number | null
          id?: string
          last_ai_analyzed_at?: string | null
          last_message_at?: string
          last_prospect_message_at?: string | null
          last_sales_echo_at?: string | null
          needs_ai_analysis?: boolean
          organization_id?: string | null
          quality_label?: string | null
          source_type?: string
          started_at?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ad_id?: string | null
          attribution_evidence?: Json
          attribution_status?: string
          campaign_id?: string | null
          capi_event_id?: string | null
          capi_sync_status?: string | null
          capi_synced_at?: string | null
          channel?: string
          channel_conversation_id?: string | null
          connection_id?: string | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_wa_id?: string | null
          deduplication_id?: string | null
          first_message_at?: string | null
          first_response_time_seconds?: number | null
          id?: string
          last_ai_analyzed_at?: string | null
          last_message_at?: string
          last_prospect_message_at?: string | null
          last_sales_echo_at?: string | null
          needs_ai_analysis?: boolean
          organization_id?: string | null
          quality_label?: string | null
          source_type?: string
          started_at?: string
          updated_at?: string
          workspace_id?: string | null
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
            foreignKeyName: "fk_conversations_campaign_org"
            columns: ["campaign_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
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
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ctwa_ad_spend_snapshots: {
        Row: {
          ad_id: string
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number
          currency: string
          date_start: string
          date_stop: string
          id: string
          impressions: number
          spend: number
          synced_at: string
          workspace_id: string
        }
        Insert: {
          ad_id: string
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          currency?: string
          date_start: string
          date_stop: string
          id?: string
          impressions?: number
          spend?: number
          synced_at?: string
          workspace_id: string
        }
        Update: {
          ad_id?: string
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          currency?: string
          date_start?: string
          date_stop?: string
          id?: string
          impressions?: number
          spend?: number
          synced_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctwa_ad_spend_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ctwa_attributions: {
        Row: {
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          attribution_confidence: number | null
          body: string | null
          campaign_id: string | null
          campaign_name: string | null
          conversation_id: string
          created_at: string
          ctwa_clid: string | null
          headline: string | null
          id: string
          source_id: string
          source_type: string
          source_url: string | null
          workspace_id: string
        }
        Insert: {
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          attribution_confidence?: number | null
          body?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          conversation_id: string
          created_at?: string
          ctwa_clid?: string | null
          headline?: string | null
          id?: string
          source_id: string
          source_type: string
          source_url?: string | null
          workspace_id: string
        }
        Update: {
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          attribution_confidence?: number | null
          body?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          conversation_id?: string
          created_at?: string
          ctwa_clid?: string | null
          headline?: string | null
          id?: string
          source_id?: string
          source_type?: string
          source_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctwa_attributions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctwa_attributions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      lead_ai_analyses: {
        Row: {
          confidence: number
          conversation_id: string
          created_at: string
          evidence: Json
          id: string
          lead_id: string
          lead_temperature: string
          model_name: string
          pipeline_stage_suggestion: string
          prompt_version: string
          raw_output: Json
          score: number
          workspace_id: string
        }
        Insert: {
          confidence: number
          conversation_id: string
          created_at?: string
          evidence?: Json
          id?: string
          lead_id: string
          lead_temperature: string
          model_name: string
          pipeline_stage_suggestion: string
          prompt_version: string
          raw_output?: Json
          score: number
          workspace_id: string
        }
        Update: {
          confidence?: number
          conversation_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          lead_id?: string
          lead_temperature?: string
          model_name?: string
          pipeline_stage_suggestion?: string
          prompt_version?: string
          raw_output?: Json
          score?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_ai_analyses_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ai_analyses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ai_analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      lead_pipeline_events: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          created_at: string
          from_stage: string | null
          from_temperature: string | null
          id: string
          lead_id: string
          reason: string | null
          to_stage: string | null
          to_temperature: string | null
          workspace_id: string
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          created_at?: string
          from_stage?: string | null
          from_temperature?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          to_stage?: string | null
          to_temperature?: string | null
          workspace_id: string
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          from_stage?: string | null
          from_temperature?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          to_stage?: string | null
          to_temperature?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_pipeline_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_pipeline_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_confidence: number | null
          ai_score: number | null
          ai_summary: string | null
          assigned_sales_id: string | null
          connection_id: string
          conversation_id: string
          created_at: string
          customer_name: string | null
          customer_phone_masked: string | null
          id: string
          lead_temperature: string
          manual_stage_lock: boolean
          needs_human_review: boolean
          pipeline_stage: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_score?: number | null
          ai_summary?: string | null
          assigned_sales_id?: string | null
          connection_id: string
          conversation_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone_masked?: string | null
          id?: string
          lead_temperature?: string
          manual_stage_lock?: boolean
          needs_human_review?: boolean
          pipeline_stage?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_score?: number | null
          ai_summary?: string | null
          assigned_sales_id?: string | null
          connection_id?: string
          conversation_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone_masked?: string | null
          id?: string
          lead_temperature?: string
          manual_stage_lock?: boolean
          needs_human_review?: boolean
          pipeline_stage?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_sales_id_fkey"
            columns: ["assigned_sales_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          body_text: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          message_type: string
          organization_id: string | null
          provider_message_id: string | null
          raw_metadata: Json
          sender_type: string
          sent_at: string
          wamid: string | null
          workspace_id: string | null
        }
        Insert: {
          body?: string
          body_text?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          message_type?: string
          organization_id?: string | null
          provider_message_id?: string | null
          raw_metadata?: Json
          sender_type?: string
          sent_at?: string
          wamid?: string | null
          workspace_id?: string | null
        }
        Update: {
          body?: string
          body_text?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          organization_id?: string | null
          provider_message_id?: string | null
          raw_metadata?: Json
          sender_type?: string
          sent_at?: string
          wamid?: string | null
          workspace_id?: string | null
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
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          meta_x_business_use_case_usage: Json | null
          organization_id: string
          provider: string
          records_processed: number
          records_rejected: number
          resume_after: string | null
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
          meta_x_business_use_case_usage?: Json | null
          organization_id: string
          provider: string
          records_processed?: number
          records_rejected?: number
          resume_after?: string | null
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
          meta_x_business_use_case_usage?: Json | null
          organization_id?: string
          provider?: string
          records_processed?: number
          records_rejected?: number
          resume_after?: string | null
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
          encryption_iv: string | null
          encryption_tag: string | null
          expires_at: string | null
          id: string
          key_version: number
          organization_id: string | null
          token_expires_at: string | null
          token_type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          encrypted_access_token: string
          encryption_iv?: string | null
          encryption_tag?: string | null
          expires_at?: string | null
          id?: string
          key_version?: number
          organization_id?: string | null
          token_expires_at?: string | null
          token_type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          encrypted_access_token?: string
          encryption_iv?: string | null
          encryption_tag?: string | null
          expires_at?: string | null
          id?: string
          key_version?: number
          organization_id?: string | null
          token_expires_at?: string | null
          token_type?: string
          updated_at?: string
          workspace_id?: string | null
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
          {
            foreignKeyName: "whatsapp_connection_secrets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          coexistence_enabled: boolean
          connected_at: string | null
          connected_by: string | null
          connection_status: string
          created_at: string
          disconnected_at: string | null
          display_phone_number: string | null
          id: string
          integration_mode: string
          last_echo_at: string | null
          last_webhook_received_at: string | null
          metadata: Json
          organization_id: string | null
          phone_number_id: string
          sales_member_id: string | null
          updated_at: string
          verified_name: string | null
          waba_id: string | null
          workspace_id: string | null
        }
        Insert: {
          coexistence_enabled?: boolean
          connected_at?: string | null
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          disconnected_at?: string | null
          display_phone_number?: string | null
          id?: string
          integration_mode?: string
          last_echo_at?: string | null
          last_webhook_received_at?: string | null
          metadata?: Json
          organization_id?: string | null
          phone_number_id: string
          sales_member_id?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          coexistence_enabled?: boolean
          connected_at?: string | null
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          disconnected_at?: string | null
          display_phone_number?: string | null
          id?: string
          integration_mode?: string
          last_echo_at?: string | null
          last_webhook_received_at?: string | null
          metadata?: Json
          organization_id?: string | null
          phone_number_id?: string
          sales_member_id?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_sales_member_id_fkey"
            columns: ["sales_member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_projects: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          project_name: string
          campaign_name: string | null
          headline: string | null
          subheadline: string | null
          description: string | null
          property_type: string | null
          property_location: string | null
          starting_price: number | null
          land_area: number | null
          building_area: number | null
          bedrooms: number | null
          bathrooms: number | null
          floors: number | null
          promo_headline: string | null
          cashback_amount: number | null
          has_free_ppn: boolean
          dp_amount: number | null
          monthly_installment: number | null
          kpr_rate: number | null
          promo_deadline: string | null
          cta_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          project_name: string
          campaign_name?: string | null
          headline?: string | null
          subheadline?: string | null
          description?: string | null
          property_type?: string | null
          property_location?: string | null
          starting_price?: number | null
          land_area?: number | null
          building_area?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          floors?: number | null
          promo_headline?: string | null
          cashback_amount?: number | null
          has_free_ppn?: boolean
          dp_amount?: number | null
          monthly_installment?: number | null
          kpr_rate?: number | null
          promo_deadline?: string | null
          cta_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          project_name?: string
          campaign_name?: string | null
          headline?: string | null
          subheadline?: string | null
          description?: string | null
          property_type?: string | null
          property_location?: string | null
          starting_price?: number | null
          land_area?: number | null
          building_area?: number | null
          bedrooms?: number | null
          bathrooms?: number | null
          floors?: number | null
          promo_headline?: string | null
          cashback_amount?: number | null
          has_free_ppn?: boolean
          dp_amount?: number | null
          monthly_installment?: number | null
          kpr_rate?: number | null
          promo_deadline?: string | null
          cta_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_generations: {
        Row: {
          id: string
          project_id: string | null
          conversation_id: string | null
          parent_generation_id: string | null
          revision_instruction: string | null
          model_used: string | null
          provider: string | null
          organization_id: string
          user_id: string
          aspect_ratio: string
          style_preset: string
          width: number
          height: number
          raw_image_url: string
          final_composed_url: string | null
          creative_direction: Json
          prompt_used: string
          quality_score: Json
          status: string
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          conversation_id?: string | null
          parent_generation_id?: string | null
          revision_instruction?: string | null
          model_used?: string | null
          provider?: string | null
          organization_id: string
          user_id: string
          aspect_ratio: string
          style_preset?: string
          width: number
          height: number
          raw_image_url: string
          final_composed_url?: string | null
          creative_direction?: Json
          prompt_used?: string
          quality_score?: Json
          status?: string
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          conversation_id?: string | null
          parent_generation_id?: string | null
          revision_instruction?: string | null
          model_used?: string | null
          provider?: string | null
          organization_id?: string
          user_id?: string
          aspect_ratio?: string
          style_preset?: string
          width?: number
          height?: number
          raw_image_url?: string
          final_composed_url?: string | null
          creative_direction?: Json
          prompt_used?: string
          quality_score?: Json
          status?: string
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_generations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_assets: {
        Row: {
          id: string
          project_id: string
          organization_id: string
          category: string
          file_name: string
          file_url: string
          file_size_bytes: number | null
          mime_type: string | null
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          organization_id: string
          category: string
          file_name: string
          file_url: string
          file_size_bytes?: number | null
          mime_type?: string | null
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          organization_id?: string
          category?: string
          file_name?: string
          file_url?: string
          file_size_bytes?: number | null
          mime_type?: string | null
          is_primary?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_variations: {
        Row: {
          id: string
          generation_id: string
          project_id: string
          organization_id: string
          variation_label: string
          style_preset: string
          final_composed_url: string
          headline: string
          accent_color: string
          creative_direction: Json
          created_at: string
        }
        Insert: {
          id?: string
          generation_id: string
          project_id: string
          organization_id: string
          variation_label: string
          style_preset: string
          final_composed_url: string
          headline: string
          accent_color: string
          creative_direction?: Json
          created_at?: string
        }
        Update: {
          id?: string
          generation_id?: string
          project_id?: string
          organization_id?: string
          variation_label?: string
          style_preset?: string
          final_composed_url?: string
          headline?: string
          accent_color?: string
          creative_direction?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_variations_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "creative_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_image_enhancements: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          original_image_path: string
          original_image_url: string
          enhanced_image_path: string | null
          enhanced_image_url: string | null
          original_width: number | null
          original_height: number | null
          output_width: number | null
          output_height: number | null
          file_name: string
          file_size: number | null
          enhanced_file_size: number | null
          mime_type: string | null
          enhancement_mode: string
          preset: string
          intensity: number
          processing_config: Json
          processing_status: "queued" | "validating" | "analyzing" | "processing" | "completed" | "failed"
          processing_metadata: Json
          scene_category: string | null
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          original_image_path: string
          original_image_url: string
          enhanced_image_path?: string | null
          enhanced_image_url?: string | null
          original_width?: number | null
          original_height?: number | null
          output_width?: number | null
          output_height?: number | null
          file_name: string
          file_size?: number | null
          enhanced_file_size?: number | null
          mime_type?: string | null
          enhancement_mode: string
          preset: string
          intensity?: number
          processing_config?: Json
          processing_status: "queued" | "validating" | "analyzing" | "processing" | "completed" | "failed"
          processing_metadata?: Json
          scene_category?: string | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          original_image_path?: string
          original_image_url?: string
          enhanced_image_path?: string | null
          enhanced_image_url?: string | null
          original_width?: number | null
          original_height?: number | null
          output_width?: number | null
          output_height?: number | null
          file_name?: string
          file_size?: number | null
          enhanced_file_size?: number | null
          mime_type?: string | null
          enhancement_mode?: string
          preset?: string
          intensity?: number
          processing_config?: Json
          processing_status?: "queued" | "validating" | "analyzing" | "processing" | "completed" | "failed"
          processing_metadata?: Json
          scene_category?: string | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_image_enhancements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_conversations: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          project_id: string | null
          title: string
          is_pinned: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          project_id?: string | null
          title?: string
          is_pinned?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          project_id?: string | null
          title?: string
          is_pinned?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_messages: {
        Row: {
          id: string
          conversation_id: string
          organization_id: string
          user_id: string
          role: "user" | "assistant" | "system"
          content: string
          attachments: Json
          generation_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          organization_id: string
          user_id: string
          role: "user" | "assistant" | "system"
          content: string
          attachments?: Json
          generation_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          organization_id?: string
          user_id?: string
          role?: "user" | "assistant" | "system"
          content?: string
          attachments?: Json
          generation_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "studio_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_messages_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "creative_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_memories: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          project_id: string | null
          category: string
          key: string
          value: string
          confidence: number
          source_message_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          project_id?: string | null
          category: string
          key: string
          value: string
          confidence?: number
          source_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          project_id?: string | null
          category?: string
          key?: string
          value?: string
          confidence?: number
          source_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_memories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_memories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "creative_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          max_whatsapp_connections: number
          plan: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          max_whatsapp_connections: number
          plan: string
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          max_whatsapp_connections?: number
          plan?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          meta_event_id: string
          payload: Json
          phone_number_id: string
          processed_at: string | null
          received_at: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          meta_event_id: string
          payload: Json
          phone_number_id: string
          processed_at?: string | null
          received_at?: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          meta_event_id?: string
          payload?: Json
          phone_number_id?: string
          processed_at?: string | null
          received_at?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      is_workspace_admin: { Args: { ws_id: string }; Returns: boolean }
      is_workspace_member: { Args: { ws_id: string }; Returns: boolean }
      reserve_ai_analysis_usage: {
        Args: { p_user_id: string; p_idempotency_key: string }
        Returns: { allowed: boolean; reservation_status: string; reservation_id: string | null; used_count: number; reserved_count: number; remaining_count: number; next_available_at: string | null }[]
      }
      complete_ai_analysis_usage: {
        Args: { p_user_id: string; p_reservation_id: string; p_succeeded: boolean; p_failure_code?: string | null }
        Returns: boolean
      }
      get_ai_analysis_usage: {
        Args: { p_user_id: string }
        Returns: { used_count: number; reserved_count: number; remaining_count: number; next_available_at: string | null }[]
      }
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
