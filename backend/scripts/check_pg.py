import psycopg2

conn = psycopg2.connect(
    host="localhost", port=5432, dbname="fsp_talent_db", user="fsp", password="fsp"
)
cur = conn.cursor()
cur.execute(
    """
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY 1
    """
)
print("tables:", cur.fetchall())
cur.execute(
    """
    SELECT c.relname, pg_catalog.pg_get_userbyid(c.relowner)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    """
)
print("owners:", cur.fetchall())
conn.close()
