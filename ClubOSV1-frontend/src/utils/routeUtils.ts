import type { RequestRoute } from "@/types/request";

interface RouteKeywords {
  [key: string]: string[];
}

const routeKeywords: RouteKeywords = {
  "Booking&Access": [
    "booking", "book", "reservation", "reserve", "refund", "credit", 
    "access", "entry", "door", "key", "card", "membership", "pass"
  ],
  "Emergency": [
    "urgent", "emergency", "help", "immediate", "safety", "danger", 
    "injury", "accident", "fire", "security", "police", "medical"
  ],
  "TechSupport": [
    "technical", "tech", "equipment", "broken", "fix", "issue", 
    "problem", "troubleshoot", "wifi", "internet", "computer", "device",
    "software", "hardware", "printer", "screen", "audio", "video"
  ],
  "BrandTone": [
    "marketing", "brand", "tone", "message", "content", "social", 
    "media", "campaign", "promotion", "advertisement", "design", "logo"
  ]
};

export const determineRoute = (description: string): RequestRoute => {
  const lowerDescription = description.toLowerCase();
  
  for (const [route, keywords] of Object.entries(routeKeywords)) {
    for (const keyword of keywords) {
      if (lowerDescription.includes(keyword)) {
        return route as RequestRoute;
      }
    }
  }
  
  return "Auto";
};

export const getRouteDescription = (route: RequestRoute): string => {
  switch (route) {
    case "Booking&Access":
      return "Handles bookings, refunds, credits, and access issues";
    case "Emergency":
      return "For urgent safety and immediate help requests";
    case "TechSupport":
      return "Technical issues and equipment troubleshooting";
    case "BrandTone":
      return "Marketing, brand queries, and tone adjustments";
    case "Auto":
      return "Automatically routes to the most appropriate bot";
    default:
      return "";
  }
};
