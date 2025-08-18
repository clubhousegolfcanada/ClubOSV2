# Knowledge Database Audit Report
Generated: 2025-08-18T02:48:08.496Z

## Summary
- Total Knowledge Items: 1
- Tables with Data: 1/4

## Coverage
- hasHours: ❌
- hasPricing: ❌
- hasBooking: ❌
- hasTechnical: ❌
- hasEmergency: ❌
- hasPolicies: ❌

## Gaps
- Hours
- Pricing
- Booking
- Technical
- Emergency
- Policies

## Recommendations

2. Add knowledge for: Hours, Pricing, Booking, Technical, Emergency, Policies
3. Expand knowledge base - current coverage is minimal

## Raw Data
[
  {
    "table": "assistant_knowledge",
    "totalRecords": 1,
    "sampleRecords": [
      {
        "id": 1,
        "assistant_id": "asst_E2CrYEtb5CKJGPZYdE7z7VAq",
        "route": "Booking & Access",
        "knowledge": {
          "automatedResponses": {
            "gift_cards": [
              {
                "query": "do you sell giftcards?",
                "response": "Yes, gift cards are available and can be purchased online. You can find You on our website at clubhouse247golf.com/gift-card/purchase.",
                "timestamp": "2025-08-05T23:10:38.950Z",
                "confidence": "high"
              },
              {
                "query": "do you sell giftcards?",
                "response": "Yes, you can purchase gift cards for Clubhouse 24/7 Golf online. Please visit [clubhouse247golf.com/gift-card/purchase](https://clubhouse247golf.com/gift-card/purchase) for a direct link to purchase gift cards.",
                "timestamp": "2025-08-05T23:18:30.203Z",
                "confidence": "high"
              },
              {
                "query": "do you sell giftcards?",
                "response": "Yes, we do sell gift cards. You can purchase You at clubhouse247golf.com/gift-card/purchase .",
                "timestamp": "2025-08-05T23:24:09.327Z",
                "confidence": "high"
              },
              {
                "query": "do you sell giftcards?",
                "response": "Yes, we do sell gift cards. Digital gift cards can be purchased online and used anytime as they do not have an expiry date. You can buy You through our website at the following link: [Buy Gift Card](https://www.clubhouse247golf.com/giftcard/purchase).",
                "timestamp": "2025-08-06T00:10:49.077Z",
                "confidence": "high"
              }
            ]
          }
        },
        "version": "1.0",
        "created_at": "2025-08-06T02:10:38.952Z",
        "updated_at": "2025-08-06T03:10:49.079Z"
      }
    ],
    "categories": {
      "unknown": 1
    },
    "coverage": {
      "hasHours": false,
      "hasPricing": false,
      "hasBooking": false,
      "hasTechnical": false,
      "hasEmergency": false,
      "hasPolicies": false
    },
    "quality": {
      "avgConfidence": 0,
      "withHighConfidence": 0,
      "withLowConfidence": 0,
      "outdated": 0
    }
  },
  {
    "table": "extracted_knowledge",
    "totalRecords": 0,
    "sampleRecords": [],
    "categories": {},
    "coverage": {
      "hasHours": false,
      "hasPricing": false,
      "hasBooking": false,
      "hasTechnical": false,
      "hasEmergency": false,
      "hasPolicies": false
    },
    "quality": {
      "avgConfidence": 0,
      "withHighConfidence": 0,
      "withLowConfidence": 0,
      "outdated": 0
    }
  }
]
