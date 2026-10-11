-- Выполнить в pgAdmin на БД fsp_talent_db под суперпользователем (postgres / document).

ALTER DATABASE fsp_talent_db OWNER TO fsp;

GRANT ALL ON SCHEMA public TO fsp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fsp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fsp;
GRANT ALL PRIVILEGES ON ALL TYPES IN SCHEMA public TO fsp;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fsp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fsp;

-- Передать владельца всех таблиц/последовательностей роли fsp
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO fsp', r.tablename);
  END LOOP;
  FOR r IN
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO fsp', r.sequence_name);
  END LOOP;
  FOR r IN
    SELECT typname FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO fsp', r.typname);
  END LOOP;
END $$;
