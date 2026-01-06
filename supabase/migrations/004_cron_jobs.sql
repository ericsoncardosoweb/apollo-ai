-- ===========================================
-- Apollo A.I. Advanced - Cron Jobs and Database Webhooks
-- Requires pg_cron and pg_net extensions
-- ===========================================

-- ===========================================
-- RE-ENGAGEMENT CRON JOB (ARREMATE)
-- Runs every 5 minutes to check for inactive conversations
-- ===========================================

-- Function to find and flag conversations needing re-engagement
CREATE OR REPLACE FUNCTION check_reengagement_needed()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER := 0;
    conv RECORD;
BEGIN
    -- Loop through agents with re-engagement enabled
    FOR conv IN 
        SELECT 
            c.id AS conversation_id,
            c.tenant_id,
            c.agent_id,
            c.phone_number,
            c.reengagement_attempts,
            c.last_message_at,
            a.reengagement_delay_minutes,
            a.reengagement_max_attempts,
            a.business_hours
        FROM public.conversations c
        INNER JOIN public.agents a ON a.id = c.agent_id
        WHERE c.status = 'active'
            AND c.mode = 'ai'
            AND a.reengagement_enabled = true
            AND c.reengagement_attempts < a.reengagement_max_attempts
            AND c.last_message_at < NOW() - (a.reengagement_delay_minutes || ' minutes')::INTERVAL
    LOOP
        -- Check if within business hours (simplified: 9-21)
        IF conv.business_hours->>'enabled' = 'true' THEN
            IF EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 9 
               OR EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') >= 21 THEN
                CONTINUE;
            END IF;
        END IF;
        
        -- Check last message was from AI/agent (not customer)
        IF EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.conversation_id = conv.conversation_id
            ORDER BY m.created_at DESC LIMIT 1
        ) THEN
            -- Verify sender type
            IF (
                SELECT sender_type FROM public.messages 
                WHERE conversation_id = conv.conversation_id 
                ORDER BY created_at DESC LIMIT 1
            ) NOT IN ('ai', 'agent', 'human_agent') THEN
                CONTINUE; -- Customer sent last, don't re-engage
            END IF;
        END IF;
        
        -- Increment attempt and trigger event (will be caught by database webhook)
        UPDATE public.conversations 
        SET 
            reengagement_attempts = reengagement_attempts + 1,
            updated_at = NOW()
        WHERE id = conv.conversation_id;
        
        -- Insert reengagement event for webhook
        INSERT INTO public.reengagement_events (
            conversation_id, 
            tenant_id, 
            agent_id, 
            phone_number, 
            attempt_number,
            created_at
        ) VALUES (
            conv.conversation_id,
            conv.tenant_id,
            conv.agent_id,
            conv.phone_number,
            conv.reengagement_attempts + 1,
            NOW()
        );
        
        affected_count := affected_count + 1;
    END LOOP;
    
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- Create table for reengagement events (for webhooks)
CREATE TABLE IF NOT EXISTS public.reengagement_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    agent_id UUID REFERENCES public.agents(id),
    phone_number VARCHAR(20),
    attempt_number INTEGER DEFAULT 1,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reengagement_events_unprocessed 
    ON public.reengagement_events(processed, created_at) 
    WHERE processed = false;

-- Enable RLS
ALTER TABLE public.reengagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.reengagement_events 
    FOR ALL USING (true);


-- ===========================================
-- SCHEDULE CRON JOB
-- Runs every 5 minutes
-- ===========================================

-- Remove existing job if any
SELECT cron.unschedule('reengagement-check') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'reengagement-check'
);

-- Schedule the job
SELECT cron.schedule(
    'reengagement-check',           -- job name
    '*/5 * * * *',                  -- every 5 minutes
    'SELECT check_reengagement_needed();'
);


-- ===========================================
-- CONVERSATION STATS UPDATE
-- Updates agent stats daily
-- ===========================================

CREATE OR REPLACE FUNCTION update_agent_stats()
RETURNS void AS $$
BEGIN
    UPDATE public.agents a SET
        total_conversations = (
            SELECT COUNT(*) FROM public.conversations c 
            WHERE c.agent_id = a.id
        ),
        total_messages = (
            SELECT COUNT(*) FROM public.messages m
            INNER JOIN public.conversations c ON c.id = m.conversation_id
            WHERE c.agent_id = a.id AND m.sender_type = 'ai'
        ),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule daily at 3 AM (Brazil time ~6 AM UTC)
SELECT cron.schedule(
    'update-agent-stats',
    '0 6 * * *',
    'SELECT update_agent_stats();'
);


-- ===========================================
-- TOKEN USAGE AGGREGATION
-- Aggregates token usage monthly
-- ===========================================

CREATE OR REPLACE FUNCTION aggregate_monthly_tokens()
RETURNS void AS $$
DECLARE
    period_start DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    period_end DATE := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
    -- Aggregate from messages
    INSERT INTO public.token_usage (
        tenant_id, 
        agent_id, 
        period_start, 
        period_end, 
        tokens_input, 
        tokens_output, 
        total_tokens, 
        total_requests
    )
    SELECT 
        m.tenant_id,
        c.agent_id,
        period_start,
        period_end,
        COALESCE(SUM(m.ai_tokens_input), 0),
        COALESCE(SUM(m.ai_tokens_output), 0),
        COALESCE(SUM(m.ai_tokens_input), 0) + COALESCE(SUM(m.ai_tokens_output), 0),
        COUNT(*) FILTER (WHERE m.sender_type = 'ai')
    FROM public.messages m
    INNER JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.created_at >= period_start AND m.created_at < period_end + INTERVAL '1 day'
        AND m.ai_tokens_input IS NOT NULL
    GROUP BY m.tenant_id, c.agent_id
    ON CONFLICT (tenant_id, period_start) 
    DO UPDATE SET
        tokens_input = EXCLUDED.tokens_input,
        tokens_output = EXCLUDED.tokens_output,
        total_tokens = EXCLUDED.total_tokens,
        total_requests = EXCLUDED.total_requests,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule daily at 4 AM
SELECT cron.schedule(
    'aggregate-tokens',
    '0 7 * * *',
    'SELECT aggregate_monthly_tokens();'
);


-- ===========================================
-- CLEANUP OLD DATA
-- Remove old processed events
-- ===========================================

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete processed reengagement events older than 7 days
    DELETE FROM public.reengagement_events 
    WHERE processed = true AND created_at < NOW() - INTERVAL '7 days';
    
    -- Delete soft-deleted messages older than 30 days
    DELETE FROM public.messages 
    WHERE is_deleted = true AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule weekly on Sunday at 5 AM
SELECT cron.schedule(
    'cleanup-old-data',
    '0 8 * * 0',
    'SELECT cleanup_old_data();'
);


-- ===========================================
-- LIST SCHEDULED JOBS
-- ===========================================
-- SELECT * FROM cron.job;
