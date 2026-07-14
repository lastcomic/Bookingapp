"use client";

import { formatSpan } from "@/lib/dates";

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
  | { kind: "collision"; span: { start: string; end: string } }
  | {
      kind: "quote";
      quote: PublicQuote;
      span: { start: string; end: string };
      venue: string;
      shows: number;
    };

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export default function DealMemo({ state }: { state: MemoState }) {
  return (
    <div className="memo">
      <div className="stamp">Deal Memo</div>
      <h2>The Office of John Heffron</h2>
      <div className="memoMeta">OFFER STAGE · NOT A CONTRACT</div>

      {state.kind === "empty" && (
        <>
          <hr className="rule" />
          <div className="placeholder">
            Select a start date and enter your room details.
            <br />
            Terms render here.
          </div>
        </>
      )}

      {state.kind === "loading" && (
        <>
          <hr className="rule" />
          <div className="placeholder">Preparing terms…</div>
        </>
      )}

      {state.kind === "belowMinimum" && (
        <>
          <hr className="rule" />
          <div className="noticeBlock">
            For rooms of this size, contact the office directly at the link
            below. The calendar remains available for review.
          </div>
        </>
      )}

      {state.kind === "collision" && (
        <>
          <hr className="rule" />
          <div className="noticeBlock">
            The engagement span {formatSpan(state.span.start, state.span.end)}{" "}
            overlaps a held date. Please choose a different start date.
          </div>
        </>
      )}

      {state.kind === "quote" && (
        <>
          <hr className="rule" />
          <div className="row">
            <span className="k">Artist</span>
            <span className="v">JOHN HEFFRON</span>
          </div>
          <div className="row">
            <span className="k">Venue</span>
            <span className="v">{state.venue || "—"}</span>
          </div>
          <div className="row">
            <span className="k">Engagement</span>
            <span className="v">{formatSpan(state.span.start, state.span.end)}</span>
          </div>
          <div className="row">
            <span className="k">Shows</span>
            <span className="v">{state.shows}</span>
          </div>
          {state.quote.regionalRouting && (
            <div className="row">
              <span className="k">Routing</span>
              <span className="v">Regional Routing — Qualified</span>
            </div>
          )}
          <hr className="rule" />
          <div className="fee">
            {money(state.quote.guarantee)} GUARANTEE vs {state.quote.doorPct}%
          </div>
          <div className="clause">
            of gross box office receipts — whichever is greater. Full
            settlement terms in contract.
          </div>
          <hr className="rule" />
          <div className="clause">
            + {money(state.quote.selloutBonus)} per sold-out show
          </div>
          {state.quote.travelBuyout > 0 && (
            <div className="clause">
              + {money(state.quote.travelBuyout)} air/ground travel buyout
            </div>
          )}
          <div className="clause">Hotel provided by purchaser.</div>
          <div className="clause">No comps without Artist approval.</div>
          {state.quote.thursdayArrival && (
            <div className="clause">Thursday arrival for press.</div>
          )}
          {state.quote.depositPct > 0 && (
            <div className="clause">
              {state.quote.depositPct}% deposit due {state.quote.depositDueHours}{" "}
              hours after contract.
            </div>
          )}
          <div className="fine">
            Terms issued by the office. Subject to Artist approval and
            availability at time of confirmation.
          </div>
        </>
      )}
    </div>
  );
}
