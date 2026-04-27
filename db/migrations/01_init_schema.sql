-- ==============================================================================
-- SCHEMA: GLOBAL SETTINGS (HOST)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    id           VARCHAR       NOT NULL DEFAULT 'global',
    setting_key  VARCHAR       NOT NULL UNIQUE,
    setting_value VARCHAR       NOT NULL,
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT app_settings_pkey PRIMARY KEY (id, setting_key)
);

INSERT INTO public.app_settings (id, setting_key, setting_value) 
VALUES ('global', 'managerPassword', 'spilhoot123')
ON CONFLICT (id, setting_key) DO NOTHING;
-- ==============================================================================
-- SCHEMA: MANAJEMEN KUIS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.quizzes (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    subject       VARCHAR       NOT NULL,
    description   TEXT,
    is_active     BOOLEAN       NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  
    CONSTRAINT quizzes_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_quizzes_is_active ON public.quizzes (is_active);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.questions (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    quiz_id       UUID          NOT NULL,
    question_type VARCHAR       NOT NULL DEFAULT 'multiple_choice', -- multiple_choice atau free_text
    question_text TEXT          NOT NULL,
    image_url     BYTEA, -- opsional, untuk pertanyaan dengan gambar
    time_limit    INTEGER       NOT NULL DEFAULT 20, -- dalam detik
    cooldown      INTEGER       NOT NULL DEFAULT 5, -- dalam detik
    points        INTEGER       NOT NULL DEFAULT 1000,

    CONSTRAINT questions_pkey PRIMARY KEY (id),
    CONSTRAINT questions_quiz_id_fk FOREIGN KEY (quiz_id)
        REFERENCES public.quizzes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_questions_quiz_id ON public.questions (quiz_id);
CREATE INDEX IF NOT EXISTS ix_questions_question_type ON public.questions (question_type);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.answers (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    question_id   UUID          NOT NULL,
    answer_text   VARCHAR       NOT NULL,
    is_correct    BOOLEAN       NOT NULL DEFAULT false,

    CONSTRAINT answers_pkey PRIMARY KEY (id),
    CONSTRAINT answers_question_id_fk FOREIGN KEY (question_id)
        REFERENCES public.questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_answers_question_id ON public.answers (question_id);

-- ==============================================================================
-- SCHEMA: RIWAYAT PERMAINAN (HISTORY)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.game_sessions (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    quiz_id       UUID          NOT NULL,
    host_name     VARCHAR       NOT NULL,
    started_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    ended_at      TIMESTAMPTZ, -- Null jika permainan masih berlangsung

    CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT game_sessions_quiz_id_fk FOREIGN KEY (quiz_id)
        REFERENCES public.quizzes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_game_sessions_quiz_id ON public.game_sessions (quiz_id);
CREATE INDEX IF NOT EXISTS ix_game_sessions_started_at ON public.game_sessions (started_at);

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.player_results (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    session_id    UUID          NOT NULL,
    player_name   VARCHAR       NOT NULL,
    total_score   INTEGER       NOT NULL DEFAULT 0,
    joined_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT player_results_pkey PRIMARY KEY (id),
    CONSTRAINT player_results_session_id_fk FOREIGN KEY (session_id)
        REFERENCES public.game_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_player_results_session_id ON public.player_results (session_id);
-- Mencegah nama pemain yang sama muncul dua kali di satu sesi permainan
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_results_session_player 
    ON public.player_results (session_id, player_name);