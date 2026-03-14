-- 1. Purchases with multiple items (details.items array): set quantity to 1 where missing/zero
-- (Avoid ::numeric on non-numeric strings like 'nan' to prevent "column nan does not exist")
UPDATE cash_submissions
SET details = jsonb_set(
  details,
  '{items}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'quantity') IS NULL
          OR TRIM(COALESCE(elem->>'quantity', '')) = ''
          OR TRIM(COALESCE(elem->>'quantity', '')) = '0'
          OR NOT (TRIM(COALESCE(elem->>'quantity', '')) ~ '^[0-9]+\.?[0-9]*$')
          OR (CASE WHEN TRIM(COALESCE(elem->>'quantity', '')) ~ '^[0-9]+\.?[0-9]*$'
              THEN (elem->>'quantity')::numeric < 1
              ELSE true END)
        THEN elem || '{"quantity": 1}'::jsonb
        ELSE elem
      END
    )
    FROM jsonb_array_elements(details->'items') AS elem
  )
)
WHERE "submissionType" = 'purchases'
  AND jsonb_typeof(details->'items') = 'array'
  AND jsonb_array_length(details->'items') > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(details->'items') AS e
    WHERE (e->>'quantity') IS NULL
       OR TRIM(COALESCE(e->>'quantity', '')) = ''
       OR TRIM(COALESCE(e->>'quantity', '')) = '0'
       OR NOT (TRIM(COALESCE(e->>'quantity', '')) ~ '^[0-9]+\.?[0-9]*$')
       OR (CASE WHEN TRIM(COALESCE(e->>'quantity', '')) ~ '^[0-9]+\.?[0-9]*$'
           THEN (e->>'quantity')::numeric < 1
           ELSE true END)
  );

-- 2. Single-item purchases (details.item): set details.quantity to 1 where missing/zero
UPDATE cash_submissions
SET details = details || '{"quantity": 1}'::jsonb
WHERE "submissionType" = 'purchases'
  AND details ? 'item'
  AND (
    (details->>'quantity') IS NULL
    OR TRIM(COALESCE(details->>'quantity', '')) = ''
    OR TRIM(COALESCE(details->>'quantity', '')) = '0'
    OR NOT (TRIM(COALESCE(details->>'quantity', '')) ~ '^[0-9]+\.?[0-9]*$')
    OR (CASE WHEN TRIM(COALESCE(details->>'quantity', '')) ~ '^[0-9]+\.?[0-9]*$'
        THEN (details->>'quantity')::numeric < 1
        ELSE true END)
  );
