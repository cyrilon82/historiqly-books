export type VerdictType =
  | "confirmed_hoax"
  | "scientific_fraud"
  | "propaganda_forgery"
  | "literary_fraud"
  | "photo_manipulation"
  | "myth_debunked"
  | "cold_case"
  | "disappearance"
  | "conspiracy"
  | "secret_society"
  | "declassified"
  | "unexplained"
  | "lost_civilization"
  | "archaeological";

export interface Case {
  id: string;
  volumeSlug: string;
  caseNumber: number;
  title: string;
  description: string;
  verdictType: VerdictType;
  verdictLabel: string;
  year: string;
  confidence: number;
  releaseDate: string;
  isFree: boolean;
  wordCount?: number;
}

export interface Volume {
  num: number;
  title: string;
  slug: string;
  icon: string;
  tagline: string;
  description: string;
  totalCases: number;
}
