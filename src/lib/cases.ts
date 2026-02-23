import type { Case } from "../data/types";
import { cases } from "../data/cases";
import { volumes } from "../data/volumes";

// Build time constants
const NOW = new Date();
const SEVEN_DAYS_AGO = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);

/**
 * Check if a case has been released (release date is in the past)
 */
export function isReleased(caseData: Case): boolean {
  return new Date(caseData.releaseDate) <= NOW;
}

/**
 * Check if a case was released in the last 7 days (for "New" badge)
 */
export function isNew(caseData: Case): boolean {
  const releaseDate = new Date(caseData.releaseDate);
  return releaseDate <= NOW && releaseDate >= SEVEN_DAYS_AGO;
}

/**
 * Get all cases for a specific volume, sorted by case number
 */
export function getCasesForVolume(volumeSlug: string): Case[] {
  return cases
    .filter((c) => c.volumeSlug === volumeSlug)
    .sort((a, b) => a.caseNumber - b.caseNumber);
}

/**
 * Get only released cases for a volume
 */
export function getReleasedCasesForVolume(volumeSlug: string): Case[] {
  return getCasesForVolume(volumeSlug).filter(isReleased);
}

/**
 * Get progress stats for a volume
 */
export function getVolumeProgress(volumeSlug: string): {
  released: number;
  total: number;
} {
  const volume = volumes.find((v) => v.slug === volumeSlug);
  const released = getReleasedCasesForVolume(volumeSlug);
  return { released: released.length, total: volume?.totalCases ?? 20 };
}

/**
 * Get all accessible (released) cases for a volume
 */
export function getAccessibleCases(volumeSlug: string): Case[] {
  return getReleasedCasesForVolume(volumeSlug);
}

/**
 * Check if a volume has any new cases (released in last 7 days)
 */
export function hasNewCases(volumeSlug: string): boolean {
  return getCasesForVolume(volumeSlug).some(isNew);
}

/**
 * Get total count of new cases across all volumes
 */
export function getNewCasesCount(): number {
  return cases.filter(isNew).length;
}

/**
 * Get free cases for a volume
 */
export function getFreeCases(volumeSlug: string): Case[] {
  return getReleasedCasesForVolume(volumeSlug).filter((c) => c.isFree);
}

/**
 * Check if a case is locked (not yet released)
 */
export function isLocked(caseData: Case): boolean {
  return !isReleased(caseData);
}
