export type RequestRoute = "Auto" | "Booking&Access" | "Emergency" | "TechSupport" | "BrandTone";

export interface UserRequest {
  requestDescription: string;
  location?: string;
  routePreference?: RequestRoute;
  smartAssistEnabled: boolean;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}
