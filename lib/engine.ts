// The deal engine. Server-side only — nothing in this file may be imported
// by client components. Floors, targets, and walkout math never leave the server.

export type EngineConfig = {
  artistName: string;
  homeBase: string;
  driveRadiusHours: number;
  winterRadiusHours: number;
  driveFloor4Show: number;
  flyFloor: number;
  flyBuyout: number;
  guaranteeTargetPct: number; // % of gross potential
  sanityCapPct: number; // % of gross potential
  roundTo: number;
  doorPct: number; // the "vs" split
  selloutBonus: number; // per sold-out show
  depositPct: number; // first-time buyers
  depositDueHours: number;
  minCapacity: number;
  autoDeclinePct: number; // offers under this % of engine quote
  autoDeclineEnabled: boolean;
  accessCode: string; // buyer-facing front-door code; empty = page open
  requireEmailVerification: boolean;
  offerFirst: boolean; // buyers make an offer; engine quote stays admin-only
  ballparkPct: number; // offers at/above this % of quote get an encouragement stamp
};

export const DEFAULT_CONFIG: EngineConfig = {
  artistName: "John Heffron",
  homeBase: "Detroit, MI",
  driveRadiusHours: 3.0,
  winterRadiusHours: 2.0,
  driveFloor4Show: 3000,
  flyFloor: 3500,
  flyBuyout: 500,
  guaranteeTargetPct: 18,
  sanityCapPct: 35,
  roundTo: 250,
  doorPct: 65,
  selloutBonus: 250,
  depositPct: 20,
  depositDueHours: 72,
  minCapacity: 100,
  autoDeclinePct: 70,
  autoDeclineEnabled: true,
  accessCode: "",
  requireEmailVerification: false,
  offerFirst: true,
  ballparkPct: 90,
};

export type EngineInput = {
  capacity: number;
  ticketPrice: number;
  shows: number;
  startDate: string; // YYYY-MM-DD
  driveMinutes: number | null; // null = unknown → treated as fly
  firstTime: boolean;
};

// Everything the engine knows. Only `PublicQuote` may be sent to a buyer.
export type EngineQuote = {
  grossPotential: number;
  isDrive: boolean;
  isWinter: boolean;
  floor: number;
  guarantee: number;
  doorPct: number;
  selloutBonus: number;
  travelBuyout: number; // 0 on drive dates
  depositPct: number; // 0 for repeat buyers
  depositDueHours: number;
  walkoutPotential: number; // ADMIN ONLY
  spanDays: number;
};

// The subset a buyer is allowed to see. No floors, no gross potential,
// no walkout, no breakpoints.
export type PublicQuote = {
  guarantee: number;
  doorPct: number;
  selloutBonus: number;
  travelBuyout: number;
  regionalRouting: boolean;
  depositPct: number;
  depositDueHours: number;
  thursdayArrival: boolean;
  spanDays: number;
};

import { spanDaysForShows } from "@/lib/dates";
export { spanDaysForShows };

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// Modest scale-down of the 4-show drive floor for shorter engagements.
function driveFloorFor(shows: number, floor4Show: number, step: number): number {
  const scale = shows >= 4 ? 1.0 : shows === 3 ? 0.85 : shows === 2 ? 0.7 : 0.6;
  return roundTo(floor4Show * scale, step);
}

export function isWinterDate(startDate: string): boolean {
  const month = Number(startDate.slice(5, 7)); // 1-12
  return month >= 11 || month <= 3;
}

export function computeQuote(cfg: EngineConfig, input: EngineInput): EngineQuote {
  const shows = Math.min(Math.max(Math.round(input.shows), 1), 6);
  const gross = input.capacity * input.ticketPrice * shows;
  const winter = isWinterDate(input.startDate);
  const radiusMinutes =
    (winter ? cfg.winterRadiusHours : cfg.driveRadiusHours) * 60;
  const isDrive =
    input.driveMinutes !== null && input.driveMinutes <= radiusMinutes;

  const floor = isDrive
    ? driveFloorFor(shows, cfg.driveFloor4Show, cfg.roundTo)
    : cfg.flyFloor;

  let guarantee = gross * (cfg.guaranteeTargetPct / 100);
  guarantee = Math.min(guarantee, gross * (cfg.sanityCapPct / 100));
  guarantee = Math.max(guarantee, floor);
  guarantee = roundTo(guarantee, cfg.roundTo);

  const walkoutPotential = Math.max(guarantee, gross * (cfg.doorPct / 100));

  return {
    grossPotential: gross,
    isDrive,
    isWinter: winter,
    floor,
    guarantee,
    doorPct: cfg.doorPct,
    selloutBonus: cfg.selloutBonus,
    travelBuyout: isDrive ? 0 : cfg.flyBuyout,
    depositPct: input.firstTime ? cfg.depositPct : 0,
    depositDueHours: cfg.depositDueHours,
    walkoutPotential,
    spanDays: spanDaysForShows(shows),
  };
}

export function toPublicQuote(q: EngineQuote, shows: number): PublicQuote {
  return {
    guarantee: q.guarantee,
    doorPct: q.doorPct,
    selloutBonus: q.selloutBonus,
    travelBuyout: q.travelBuyout,
    regionalRouting: q.isDrive,
    depositPct: q.depositPct,
    depositDueHours: q.depositDueHours,
    thursdayArrival: shows >= 4,
    spanDays: q.spanDays,
  };
}

export type OfferTerms = {
  guarantee: number;
  doorPct: number;
  travel: number;
  hotel: boolean;
};

// An offer is measured against the engine guarantee. Travel money counts
// toward the comparison; a missing hotel does not sink it in v1.
export function offerMeetsThreshold(
  cfg: EngineConfig,
  quote: EngineQuote,
  offer: OfferTerms
): boolean {
  if (!cfg.autoDeclineEnabled) return true;
  const offeredValue = offer.guarantee + (offer.travel || 0);
  const engineValue = quote.guarantee + quote.travelBuyout;
  return offeredValue >= engineValue * (cfg.autoDeclinePct / 100);
}

// Encouragement only: an offer at/above the ballpark threshold earns a
// warm stamp on the buyer's confirmation. Revealed after the offer is sent,
// so it can't be used to probe the private quote.
export function offerInBallpark(
  cfg: EngineConfig,
  quote: EngineQuote,
  offer: OfferTerms
): boolean {
  const offeredValue = offer.guarantee + (offer.travel || 0);
  const engineValue = quote.guarantee + quote.travelBuyout;
  return offeredValue >= engineValue * (cfg.ballparkPct / 100);
}
