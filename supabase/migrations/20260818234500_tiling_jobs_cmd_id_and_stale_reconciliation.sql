-- Tracks the detached sandbox command's ID so a stuck job can be inspected
-- later via sandbox.getCommand(cmdId) instead of being a total black box.
alter table public.tiling_jobs add column cmd_id text;
