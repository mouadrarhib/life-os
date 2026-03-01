-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text CHECK (type = ANY (ARRAY['cash'::text, 'bank'::text, 'card'::text, 'wallet'::text, 'trading'::text])),
  currency text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attachments_pkey PRIMARY KEY (id),
  CONSTRAINT attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.certifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  provider text,
  obtained_at date,
  expires_at date,
  credential_url text,
  proof_file_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT certifications_pkey PRIMARY KEY (id),
  CONSTRAINT certifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT cert_proof_fk FOREIGN KEY (proof_file_id) REFERENCES public.attachments(id)
);
CREATE TABLE public.client_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  role text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_contacts_pkey PRIMARY KEY (id),
  CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  city text,
  industry text,
  status text DEFAULT 'lead'::text CHECK (status = ANY (ARRAY['lead'::text, 'active'::text, 'inactive'::text])),
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  stage text DEFAULT 'lead'::text CHECK (stage = ANY (ARRAY['lead'::text, 'contacted'::text, 'proposal'::text, 'won'::text, 'lost'::text])),
  value_amount numeric,
  currency text,
  next_step_date date,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deals_pkey PRIMARY KEY (id),
  CONSTRAINT deals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  muscle_group text,
  equipment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exercises_pkey PRIMARY KEY (id),
  CONSTRAINT exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  horizon text CHECK (horizon = ANY (ARRAY['3m'::text, '1y'::text, '5y'::text, 'custom'::text])),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'done'::text, 'paused'::text, 'cancelled'::text])),
  start_date date,
  target_date date,
  why text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT goals_pkey PRIMARY KEY (id),
  CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  title text NOT NULL,
  due_date date,
  done boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT milestones_pkey PRIMARY KEY (id),
  CONSTRAINT milestones_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  timezone text DEFAULT 'UTC'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  tech_stack text,
  repo_url text,
  live_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.resume_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  language text,
  file_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT resume_versions_pkey PRIMARY KEY (id),
  CONSTRAINT resume_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT resume_file_fk FOREIGN KEY (file_id) REFERENCES public.attachments(id)
);
CREATE TABLE public.sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL,
  set_no integer NOT NULL,
  reps integer NOT NULL,
  weight_kg numeric,
  rpe text,
  is_warmup boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sets_pkey PRIMARY KEY (id),
  CONSTRAINT sets_workout_exercise_id_fkey FOREIGN KEY (workout_exercise_id) REFERENCES public.workout_exercises(id)
);
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo'::text CHECK (status = ANY (ARRAY['todo'::text, 'doing'::text, 'done'::text])),
  priority integer DEFAULT 0,
  due_at timestamp with time zone,
  done_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.task_focus_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode = ANY (ARRAY['pomodoro'::text, 'manual'::text])),
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])),
  is_break boolean NOT NULL DEFAULT false,
  planned_minutes integer,
  actual_minutes integer,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_focus_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT task_focus_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT task_focus_sessions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  category_id uuid NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.workout_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  order_index integer,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workout_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT workout_exercises_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES public.workouts(id),
  CONSTRAINT workout_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.workouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workouts_pkey PRIMARY KEY (id),
  CONSTRAINT workouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_focus_settings (
  user_id uuid NOT NULL,
  focus_minutes integer NOT NULL DEFAULT 25,
  break_minutes integer NOT NULL DEFAULT 5,
  auto_start_break boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_focus_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_focus_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
