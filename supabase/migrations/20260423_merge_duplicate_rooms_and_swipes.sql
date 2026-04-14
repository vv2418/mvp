-- Merge multiple rooms for the same event into one canonical room per event_id.
-- Canonical = earliest created_at (stable id).

WITH ranked AS (
  SELECT id,
         event_id,
         ROW_NUMBER() OVER (
           PARTITION BY event_id
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS rn
  FROM public.rooms
),
dups AS (
  SELECT r.id AS dup_room_id, r.event_id
  FROM ranked r
  WHERE r.rn > 1
),
canon AS (
  SELECT r.id AS keep_room_id, r.event_id
  FROM ranked r
  WHERE r.rn = 1
)
-- Drop duplicate memberships (user already in canonical room)
DELETE FROM public.room_users ru
USING dups d
JOIN canon k ON k.event_id = d.event_id
WHERE ru.room_id = d.dup_room_id
  AND EXISTS (
    SELECT 1
    FROM public.room_users ru2
    WHERE ru2.room_id = k.keep_room_id
      AND ru2.user_id = ru.user_id
  );

WITH ranked AS (
  SELECT id,
         event_id,
         ROW_NUMBER() OVER (
           PARTITION BY event_id
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS rn
  FROM public.rooms
),
dups AS (
  SELECT r.id AS dup_room_id, r.event_id
  FROM ranked r
  WHERE r.rn > 1
),
canon AS (
  SELECT r.id AS keep_room_id, r.event_id
  FROM ranked r
  WHERE r.rn = 1
)
UPDATE public.room_users ru
SET room_id = k.keep_room_id
FROM dups d
JOIN canon k ON k.event_id = d.event_id
WHERE ru.room_id = d.dup_room_id;

WITH ranked AS (
  SELECT id,
         event_id,
         ROW_NUMBER() OVER (
           PARTITION BY event_id
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS rn
  FROM public.rooms
),
dups AS (
  SELECT r.id AS dup_room_id, r.event_id
  FROM ranked r
  WHERE r.rn > 1
),
canon AS (
  SELECT r.id AS keep_room_id, r.event_id
  FROM ranked r
  WHERE r.rn = 1
)
UPDATE public.messages m
SET room_id = k.keep_room_id
FROM dups d
JOIN canon k ON k.event_id = d.event_id
WHERE m.room_id = d.dup_room_id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY event_id
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS rn
  FROM public.rooms
)
DELETE FROM public.rooms r
USING ranked x
WHERE r.id = x.id
  AND x.rn > 1;

-- One room per Ticketmaster / event id
CREATE UNIQUE INDEX IF NOT EXISTS rooms_event_id_unique ON public.rooms (event_id);

-- Duplicate swipes (same user, event, direction) — keep oldest row
DELETE FROM public.swipes s
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, event_id, direction
           ORDER BY created_at ASC NULLS LAST, id ASC
         ) AS rn
  FROM public.swipes
) z
WHERE s.id = z.id
  AND z.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS swipes_user_event_direction_unique
  ON public.swipes (user_id, event_id, direction);
