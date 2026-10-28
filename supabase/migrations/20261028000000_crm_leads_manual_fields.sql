-- Migration: Add domisili and quality_label for Haspro CRM Tahap 1
-- Core fields: Nama & WhatsApp, Domisili, Tanggal Masuk, Kampanye/Iklan, Tahap Funnel, Label Kualitas, Catatan Singkat

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS domisili TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS quality_label TEXT CHECK (quality_label IN ('Hot', 'Warm', 'Cold'));
