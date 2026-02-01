import type { Case } from "../types";
import { hoaxesCases } from "./vol-01-hoaxes";
import { mythsCases } from "./vol-02-myths";
import { coldCasesCases } from "./vol-03-cold-cases";
import { disappearancesCases } from "./vol-04-disappearances";
import { conspiraciesCases } from "./vol-05-conspiracies";
import { secretSocietiesCases } from "./vol-06-secret-societies";
import { declassifiedCases } from "./vol-07-declassified";
import { unexplainedCases } from "./vol-08-unexplained";
import { lostWorldsCases } from "./vol-09-lost-worlds";
import { archaeologicalCases } from "./vol-10-archaeological";
import { heistsCases } from "./vol-11-heists";

export const cases: Case[] = [
  ...hoaxesCases,
  ...mythsCases,
  ...coldCasesCases,
  ...disappearancesCases,
  ...conspiraciesCases,
  ...secretSocietiesCases,
  ...declassifiedCases,
  ...unexplainedCases,
  ...lostWorldsCases,
  ...archaeologicalCases,
  ...heistsCases,
];
