-- Fix TV pattern to auto-execute like gift cards
UPDATE decision_patterns
SET 
  auto_executable = TRUE,
  confidence_score = 0.90,  -- Increase confidence above the 0.85 threshold
  updated_at = NOW()
WHERE id = 221;

-- Also fix the Trackman pattern
UPDATE decision_patterns  
SET 
  auto_executable = TRUE,  -- Was already true but let's ensure it
  confidence_score = 0.90,  -- Increase from 0.85 to be safe
  updated_at = NOW()
WHERE id = 216;

-- Show the updated patterns
SELECT 
  id,
  pattern_type,
  trigger_text,
  confidence_score,
  is_active,
  auto_executable
FROM decision_patterns
WHERE id IN (216, 221);