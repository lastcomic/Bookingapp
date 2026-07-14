"use client";

import { formatDateLong, formatSpanWeekday } from "@/lib/dates";

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

export type MemoState =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "belowMinimum" }
  | {
      kind: "collision";
      span: { start: string; end: string };
      shows: number;
    }
  | {
      kind: "quote";
      quote: PublicQuote;
      span: { start: string; end: string };
      shows: number;
    };

export type OfferDraft = {
  guarantee: string;
  doorPct: string;
  travel: string;
  hotel: "yes" | "no";
};

export type MemoResult =
  | { kind: "received"; forOffer: boolean }
  | { kind: "declined"; message: string };

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export default function DealMemo({
  state,
  intent,
  result,
  roomComplete,
  offerDraft,
  onOfferDraft,
  onRequest,
  onStartOffer,
  onBackFromOffer,
  onResultBack,
}: {
  state: MemoState;
  intent: null | "request" | "offer";
  result: MemoResult | null;
  roomComplete: boolean;
  offerDraft: OfferDraft;
  onOfferDraft: (draft: OfferDraft) => void;
  onRequest: () => void;
  onStartOffer: () => void;
  onBackFromOffer: () => void;
  onResultBack: () => void;
}) {
  // Terminal states render on the paper, exactly like the prototype.
  if (result) {
    return (
      <div className="memo">
        <div className="memoHead">
          OFFICE OF JOHN HEFFRON · {result.kind === "declined" ? "SUBMIT AN OFFER" : "DEAL MEMO"}
        </div>
        <hr className="rule" />
        {result.kind === "received" ? (
          <div className="memoBody" style={{ lineHeight: 1.8 }}>
            {result.forOffer
              ? "✓ Offer received. The office reviews all offers and responds within 48 hours."
              : "✓ Request received. The office will verify and confirm within 48 hours."}
          </div>
        ) : (
          <div className="memoBody" style={{ lineHeight: 1.8 }}>
            {result.message}
            <button type="button" className="ghostPaper" onClick={onResultBack}>
              ← View standard terms
            </button>
          </div>
        )}
      </div>
    );
  }

  if (intent === "offer") {
    const set = (patch: Partial<OfferDraft>) => onOfferDraft({ ...offerDraft, ...patch });
    const numeric = (v: string) => v.replace(/[^\d]/g, "");
    return (
      <div className="memo">
        <div className="memoHead">OFFICE OF JOHN HEFFRON · SUBMIT AN OFFER</div>
        <hr className="rule" />
        <div className="engagementLine" style={{ lineHeight: 1.7, marginBottom: 10 }}>
          {state.kind === "quote" && (
            <>
              <b>Dates:</b> {formatSpanWeekday(state.span.start, state.span.end)} ·{" "}
              {state.shows} shows
              <br />
            </>
          )}
          All offers are reviewed by the office. Structured terms only.
        </div>
        <div className="paperField">
          <label>Guarantee offered ($)</label>
          <input
            inputMode="numeric"
            value={offerDraft.guarantee}
            placeholder="e.g. 4000"
            onChange={(e) => set({ guarantee: numeric(e.target.value) })}
          />
        </div>
        <div className="paperField">
          <label>Door percentage, if any (%)</label>
          <input
            inputMode="numeric"
            value={offerDraft.doorPct}
            placeholder="optional"
            onChange={(e) => set({ doorPct: numeric(e.target.value) })}
          />
        </div>
        <div className="paperField">
          <label>Travel provided ($)</label>
          <input
            inputMode="numeric"
            value={offerDraft.travel}
            placeholder="e.g. 500"
            onChange={(e) => set({ travel: numeric(e.target.value) })}
          />
        </div>
        <div className="paperField">
          <label>Hotel provided</label>
          <select
            value={offerDraft.hotel}
            onChange={(e) => set({ hotel: e.target.value as "yes" | "no" })}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="finePaper" style={{ textAlign: "left", marginTop: 12 }}>
          Complete your details below to submit this offer for review.
        </div>
        <button type="button" className="ghostPaper" onClick={onBackFromOffer}>
          ← Back to standard terms
        </button>
      </div>
    );
  }

  return (
    <div className="memo">
      {state.kind === "quote" && (
        <div className="stamp">
          {state.quote.regionalRouting ? "Regional Routing — Qualified" : "National Date"}
        </div>
      )}
      {state.kind === "belowMinimum" && <div className="stamp">Contact Office</div>}
      <div className="memoHead">OFFICE OF JOHN HEFFRON · DEAL MEMO</div>
      <hr className="rule" />

      {state.kind === "empty" && (
        <div className="memoBody">
          Select an open date on the calendar to see the deal for your room.
        </div>
      )}

      {state.kind === "loading" && <div className="memoBody">Preparing terms…</div>}

      {state.kind === "belowMinimum" && (
        <div className="memoBody">
          This room falls outside standard routing. Contact the office directly
          for availability.
        </div>
      )}

      {state.kind === "collision" && (
        <div className="memoBody">
          A {state.shows}-show engagement starting{" "}
          {formatDateLong(state.span.start)} runs into a held date. Pick a
          start date with{" "}
          {state.span.start === state.span.end
            ? "1 open day"
            : `${
                Math.round(
                  (Date.parse(state.span.end) - Date.parse(state.span.start)) / 86400000
                ) + 1
              } open days`}
          .
        </div>
      )}

      {state.kind === "quote" && (
        <>
          <div className="engagementLine">
            <b>ENGAGEMENT:</b> {formatSpanWeekday(state.span.start, state.span.end)} ·{" "}
            {state.shows} {state.shows === 1 ? "show" : "shows"}
          </div>
          <div className="kicker">GUARANTEE</div>
          <div className="big">
            {money(state.quote.guarantee)} <span className="vs">vs</span>{" "}
            {state.quote.doorPct}%
          </div>
          <div className="greater">
            of gross box office receipts — whichever is greater. Full
            settlement terms in contract.
          </div>
          <hr className="rule" />
          <div className="riders">
            <div>+ {money(state.quote.selloutBonus)} bonus per sold-out show</div>
            {state.quote.travelBuyout > 0 && (
              <div>+ {money(state.quote.travelBuyout)} travel buyout (air/ground)</div>
            )}
            <div>Hotel provided by purchaser</div>
            <div>No comps without Artist approval</div>
            {state.quote.thursdayArrival && <div>Thursday arrival for local press</div>}
            {state.quote.depositPct > 0 && (
              <div>
                {state.quote.depositPct}% deposit due {state.quote.depositDueHours} hrs
                after contract
              </div>
            )}
          </div>
          <button
            type="button"
            className="memoCta"
            disabled={!roomComplete || intent === "request"}
            onClick={onRequest}
          >
            {intent === "request" ? "Complete your details below" : "Request these dates"}
          </button>
          <button type="button" className="ghostPaper" onClick={onStartOffer}>
            Working with a different budget structure? Submit your offer
          </button>
          <div className="finePaper">
            Terms subject to Artist approval. Contract issued upon acceptance.
          </div>
        </>
      )}
    </div>
  );
}
