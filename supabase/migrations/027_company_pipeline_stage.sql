-- ============================================================================
-- 027_company_pipeline_stage.sql
-- Apollo Supabase (Master) - Adds pipeline_stage to companies for project tracking
-- Run this on the MAIN Apollo Supabase database
-- ============================================================================

-- Add pipeline_stage column to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50) DEFAULT 'lead';

-- Add status column for additional tracking
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_companies_pipeline_stage ON companies(pipeline_stage);

-- Comment on columns
COMMENT ON COLUMN companies.pipeline_stage IS 'Project stage: lead, onboard, implantacao, ativo, churn';
COMMENT ON COLUMN companies.status IS 'Company status for additional tracking';

-- ============================================================================
-- DONE - Run this on Apollo Supabase (Master)
-- ============================================================================
