-- Add Clubhouse brand color information to knowledge base

-- First, add to knowledge_base table
INSERT INTO knowledge_base (
  category,
  subcategory,
  issue,
  symptoms,
  solutions,
  priority,
  time_estimate,
  customer_script,
  metadata
) VALUES (
  'brand',
  'brand-guidelines',
  'Clubhouse brand colors and color codes',
  ARRAY['what is the clubhouse color', 'what color is clubhouse', 'brand colors', 'color code', 'hex code'],
  ARRAY[
    'The signature brand color for Clubhouse 24/7 Golf is Teal Green with the color code #0B4E43',
    'Primary Color: Teal Green (#0B4E43)',
    'Secondary Colors: White (#FFFFFF), Black (#000000), Off-White (#F8F8F8), Soft Grey (#7B7B7B)',
    'Use Teal Green for primary branding, logos, and key UI elements',
    'The Teal Green represents the premium golf experience and outdoor environment'
  ],
  'low',
  'immediate',
  'Our signature brand color is Teal Green (#0B4E43). We also use White, Black, Off-White, and Soft Grey as complementary colors in our marketing materials.',
  '{"source": "brand_guidelines", "version": "2025", "official": true}'
) ON CONFLICT DO NOTHING;

-- Also add to extracted_knowledge if that table exists
INSERT INTO extracted_knowledge (
  category,
  problem,
  solution,
  confidence,
  metadata
) VALUES (
  'brand',
  'What is the Clubhouse color code?',
  'The signature brand color for Clubhouse 24/7 Golf is Teal Green with the color code #0B4E43. The color palette also includes White (#FFFFFF), Black (#000000), Off-White (#F8F8F8), and Soft Grey (#7B7B7B) as complementary colors.',
  1.0,
  '{"source": "brand_guidelines", "version": "2025", "official": true}'
) ON CONFLICT DO NOTHING;

-- Verify the insert
SELECT 
  issue,
  solutions[1] as primary_solution
FROM knowledge_base 
WHERE issue ILIKE '%color%'
LIMIT 1;