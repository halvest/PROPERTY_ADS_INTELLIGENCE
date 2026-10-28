-- Property Ads Intelligence - Synthetic Demo Seed Data
-- CAUTION: This file contains ONLY SYNTHETIC DEMO DATA for development and testing.
-- No real personal data, actual property customer info, or live credentials exist in this file.

-- 1. Demo Organizations
INSERT INTO public.organizations (id, name, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Developer Nusantara (Demo Tenant A)', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'Demo Agency Prima (Demo Tenant B)', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 2. Demo Ad Accounts
INSERT INTO public.ad_accounts (id, organization_id, provider, provider_account_id, account_name, currency, timezone, connection_status, last_synced_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'demo', 'act_demo_nusantara_01', 'Akun Iklan Demo Nusantara', 'IDR', 'Asia/Jakarta', 'connected', now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'demo', 'act_demo_prima_02', 'Akun Iklan Demo Prima', 'IDR', 'Asia/Jakarta', 'connected', now())
ON CONFLICT (id) DO NOTHING;

-- 3. Demo Campaigns
INSERT INTO public.campaigns (id, organization_id, ad_account_id, provider_campaign_id, name, status, objective)
VALUES
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'cmp_demo_cluster_sapphire', 'Kampanye Cluster Sapphire BSD', 'ACTIVE', 'OUTCOME_LEADS'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'cmp_demo_villa_lembang', 'Kampanye Villa Heritage Lembang', 'ACTIVE', 'OUTCOME_LEADS')
ON CONFLICT (id) DO NOTHING;

-- 4. Demo Ads
INSERT INTO public.ads (id, organization_id, campaign_id, provider_ad_id, name, status)
VALUES
  ('ad000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ad_demo_sapphire_type_60', 'Iklan Sapphire Rumah 2 Lantai Siap Huni', 'ACTIVE'),
  ('ad000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ad_demo_sapphire_promo_dp', 'Iklan Sapphire Promo DP 0 Persen Cicilan Ringan', 'ACTIVE'),
  ('ad000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'ad_demo_villa_view_pegunungan', 'Iklan Villa Lembang View Pegunungan', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 5. Demo Ad Insights (Synthetic deterministic metrics)
INSERT INTO public.ad_insights (id, organization_id, ad_id, date_start, date_stop, level, spend, impressions, clicks, currency, source)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', '2026-10-01', '2026-10-25', 'ad', 4500000.00, 48200, 1250, 'IDR', 'demo'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000002', '2026-10-01', '2026-10-25', 'ad', 6200000.00, 89400, 2410, 'IDR', 'demo'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000003', '2026-10-01', '2026-10-25', 'ad', 2800000.00, 24100, 520, 'IDR', 'demo')
ON CONFLICT (id) DO NOTHING;

-- 6. Demo Contacts (Pseudonymized & masked)
INSERT INTO public.contacts (id, organization_id, name, phone_hash, phone_masked)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Budi Santoso (Demo)', 'hash_demo_budi_01', '+62 812-****-3301'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Rina Wulandari (Demo)', 'hash_demo_rina_02', '+62 813-****-4402'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Anonim WhatsApp (Demo)', 'hash_demo_anon_03', '+62 856-****-8803')
ON CONFLICT (id) DO NOTHING;

-- 7. Demo Conversations
INSERT INTO public.conversations (id, organization_id, contact_id, ad_id, channel, channel_conversation_id, attribution_status, attribution_evidence, started_at, last_message_at)
VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 'whatsapp', 'wa_conv_demo_01', 'verified', '{"referral_source": "ad_click", "ad_id": "ad_demo_sapphire_type_60", "headline": "Rumah 2 Lantai BSD"}', now() - interval '2 days', now() - interval '1 hour'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-000000000002', 'whatsapp', 'wa_conv_demo_02', 'inferred', '{"reason": "Mentioned promo DP 0 persen headline matched ad", "confidence": 0.82}', now() - interval '3 days', now() - interval '2 hours'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', NULL, 'whatsapp', 'wa_conv_demo_03', 'unknown', '{}', now() - interval '1 day', now() - interval '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- 8. Demo Messages
INSERT INTO public.messages (id, organization_id, conversation_id, provider_message_id, direction, sender_type, message_type, body, sent_at)
VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'wamid_demo_01', 'inbound', 'buyer', 'text', 'Halo, saya lihat iklan Cluster Sapphire 2 lantai di BSD. Apakah unit hook masih ada?', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'wamid_demo_02', 'outbound', 'sales', 'text', 'Halo Pak Budi, terima kasih telah menghubungi Cluster Sapphire BSD. Masih ada 2 unit hook tersisa. Boleh tahu rencana pembelian untuk ditempati sendiri atau investasi?', now() - interval '2 days' + interval '4 minutes'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'wamid_demo_03', 'inbound', 'buyer', 'text', 'Untuk tempat tinggal keluarga. Budget kami sekitar 1,8 Miliar. Bisa jadwalkan survei lokasi hari Sabtu ini jam 10 pagi?', now() - interval '2 days' + interval '12 minutes'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'wamid_demo_04', 'outbound', 'sales', 'text', 'Sangat cocok Pak! Harga tipe hook 1,75 Miliar. Saya jadwalkan survei hari Sabtu jam 10.00 WIB. Saya kirimkan titik lokasi kantor pemasaran ya Pak.', now() - interval '2 days' + interval '16 minutes')
ON CONFLICT (id) DO NOTHING;

-- 9. Demo Lead Assessments
INSERT INTO public.lead_assessments (id, organization_id, conversation_id, buyer_score, sales_score, confidence, score_completeness, status, missing_information, summary, provider, model_id, prompt_version, rubric_version)
VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 90, 88, 0.94, 1.00, 'completed', '{}', 'Lead berkualifikasi tinggi: kebutuhan jelas, anggaran cocok (1.8M), dan telah menetapkan jadwal survei.', 'meta', 'muse-spark', 'v1', 'v1')
ON CONFLICT (id) DO NOTHING;

-- 10. Demo Assessment Evidence
INSERT INTO public.assessment_evidence (id, organization_id, assessment_id, score_type, criterion, points_awarded, max_points, message_id, evidence_excerpt, explanation, evidence_status)
VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'buyer', 'purchase_intent', 25, 25, '40000000-0000-0000-0000-000000000001', 'Apakah unit hook masih ada?', 'Calon pembeli menanyakan ketersediaan unit spesifik secara langsung.', 'supported'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'buyer', 'budget_fit', 20, 20, '40000000-0000-0000-0000-000000000001', 'Budget kami sekitar 1,8 Miliar.', 'Anggaran terkonfirmasi eksplisit dan masuk dalam rentang harga unit (1,75 Miliar).', 'supported'),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'buyer', 'action_readiness', 20, 20, '40000000-0000-0000-0000-000000000001', 'Bisa jadwalkan survei lokasi hari Sabtu ini jam 10 pagi?', 'Calon pembeli berinisiatif mengajukan jadwal survei fisik.', 'supported'),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'sales', 'response_speed', 15, 15, '40000000-0000-0000-0000-000000000002', 'Waktu respons 4 menit.', 'Respons pertama di bawah 5 menit sesuai SLA terbaik.', 'supported')
ON CONFLICT (id) DO NOTHING;

-- 11. Demo Lead Outcomes
INSERT INTO public.lead_outcomes (id, organization_id, conversation_id, stage, value, currency, source, occurred_at, notes)
VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'survey', 1750000000.00, 'IDR', 'demo', now() - interval '1 day', 'Jadwal survei fisik Sabtu terkonfirmasi oleh sales.')
ON CONFLICT (id) DO NOTHING;

-- 12. Demo Sync Jobs
INSERT INTO public.sync_jobs (id, organization_id, provider, job_type, status, records_processed, records_rejected, retry_count, started_at, completed_at)
VALUES
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'demo', 'ad_insights', 'completed', 3, 0, 0, now() - interval '1 hour', now() - interval '59 minutes')
ON CONFLICT (id) DO NOTHING;
