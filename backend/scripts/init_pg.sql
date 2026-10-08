-- Выполнить в pgAdmin → Query Tool под пользователем postgres.
-- Если роль/БД уже есть — соответствующие строки можно пропустить.

CREATE ROLE fsp LOGIN PASSWORD 'fsp';

CREATE DATABASE fsp_talent_db OWNER fsp;

-- После создания БД: подключитесь к fsp_talent_db и выполните:
GRANT ALL ON SCHEMA public TO fsp;
