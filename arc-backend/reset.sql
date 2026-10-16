-- =========================
-- AUTH / USER DATA
-- =========================

-- TRUNCATE TABLE users RESTART IDENTITY CASCADE;



-- =========================
-- SESSION DATA
-- =========================

TRUNCATE TABLE test_sessions CASCADE;

-- =========================
-- ENERGY TEST
-- =========================

TRUNCATE TABLE energy_group_responses CASCADE;
TRUNCATE TABLE energy_statement_rankings CASCADE;

TRUNCATE TABLE energy_results CASCADE;
TRUNCATE TABLE energy_result_eligible_centers CASCADE;

-- =========================
-- PERSONALITY TEST
-- =========================

TRUNCATE TABLE personality_sessions CASCADE;
TRUNCATE TABLE personality_responses CASCADE;
TRUNCATE TABLE personality_result_breakdowns CASCADE;

TRUNCATE TABLE final_personality_results CASCADE;

DELETE FROM user_login_history

COMMIT;

-- how to move database
-- run: pg_dump -U [username] -d [old_database_name] -F c -f [dump_filename.dump]
-- transfer the dump_filename.dump (usb, attachment, etc)
-- create a brand new database using createdb -U postgres [new_database_name] or using pg_admin gui
-- cmd navigate to Postgres bin folder eg. "C:\program Files\PostgreSQl\bin"
--cmd: pg-restore -U postgres -d [new_database_name] "C:path_of_dump_file"
-- supply pwd for the new database.