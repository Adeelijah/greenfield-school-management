-- READ ONLY: Greenfield staging operator diagnostic, only if 55P03 persists.
-- Run during a slow request, before its 5-second lock timeout ends the waiter.
-- No query text, request parameters, actor IDs, credentials or termination calls.
-- Missing visibility must not be repaired by granting the app extra privileges.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT clock_timestamp() AS observed_at, a.pid, a.usename AS login_role,
       a.state, a.wait_event_type, a.wait_event,
       clock_timestamp()-a.xact_start AS transaction_age,
       pg_catalog.pg_blocking_pids(a.pid) AS blocking_pids
FROM pg_catalog.pg_stat_activity a
WHERE a.datname=current_database()
  AND a.usename='greenfield_app'
ORDER BY a.xact_start NULLS LAST,a.pid;

SELECT blocked.pid AS waiting_pid, blockers.pid AS blocking_pid,
       holder.usename AS blocking_login_role,holder.state AS blocking_state,
       clock_timestamp()-holder.xact_start AS blocking_transaction_age
FROM pg_catalog.pg_stat_activity blocked
CROSS JOIN LATERAL pg_catalog.unnest(pg_catalog.pg_blocking_pids(blocked.pid)) blockers(pid)
LEFT JOIN pg_catalog.pg_stat_activity holder ON holder.pid=blockers.pid
WHERE blocked.datname=current_database() AND blocked.usename='greenfield_app'
ORDER BY blocked.pid,blockers.pid;
COMMIT;
