#!/bin/bash

echo "=========================================="
echo "CREATING CORRECT BRAND DOCUMENT"
echo "=========================================="
echo ""
echo "This creates a document with the CORRECT Clubhouse brand information"
echo ""

cat > clubhouse-brand-guidelines.json << 'EOF'
{
  "document": "Clubhouse Brand Guidelines",
  "sections": [
    {
      "title": "Clubhouse Brand Colors - Official Hex Codes",
      "content": "The official Clubhouse brand colors are:\n\nPrimary Colors:\n- Clubhouse Purple: #503285 (RGB: 80, 50, 133)\n- Clubhouse Grey: #7B7B7B (RGB: 123, 123, 123)\n\nUsage:\n- Purple is used for primary branding, logos, and accent elements\n- Grey is used for text, backgrounds, and secondary elements\n\nDO NOT USE:\n- Green (#ABC123) - This is incorrect\n- Any other color variations without approval"
    },
    {
      "title": "Logo Usage Guidelines",
      "content": "The Clubhouse logo must always maintain proper spacing and proportions. Use the purple (#503285) version on light backgrounds and white version on dark backgrounds. Minimum clear space around the logo should be equal to the height of the 'C' in Clubhouse."
    },
    {
      "title": "Typography Standards",
      "content": "Primary Font: [Your font here]\nSecondary Font: [Your font here]\nBody Text: Use Clubhouse Grey (#7B7B7B) for optimal readability\nHeadings: Use Clubhouse Purple (#503285) for emphasis"
    }
  ]
}
EOF

echo ""
echo "Document created: clubhouse-brand-guidelines.json"
echo ""
echo "Upload this through the Knowledge Extraction panel to replace"
echo "the incorrect color information currently in the database."
echo ""
echo "Current wrong data shows:"
echo "  ❌ Green (#ABC123)"
echo ""
echo "Correct data should be:"
echo "  ✅ Purple (#503285)"
echo "  ✅ Grey (#7B7B7B)"