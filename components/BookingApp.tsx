"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Calendar from "@/components/Calendar";
import DealMemo, { MemoState, MemoResult, OfferDraft } from "@/components/DealMemo";
import { spanDaysForShows } from "@/lib/dates";

type Intent = null | "request" | "offer";

export default function BookingApp() {
  // Room details
  const [startDate, setStartDate] = useState<string | null>(null);
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [shows, setShows] = useState(2);
  const [repeatClaim, setRepeatClaim] = useState<boolean | null>(null);

  // Memo
  const [memo, setMemo] = useState<MemoState>({ kind: "empty" });
  const quoteSeq = useRef(0);
  const [verificationRequired, setVerificationRequired] = useState(false);

  // Intent + offer terms
  const [intent, setIntent] = useState<Intent>(null);
  const [offerReview, setOfferReview] = useState(false);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>({
    guarantee: "",
    doorPct: "",
    travel: "",
    hotel: "yes",
  });

  // Buyer contact + verification
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MemoResult | null>(null);

  const roomComplete =
    startDate !== null &&
    venue.trim() !== "" &&
    Number(capacity) > 0 &&
    Number(ticketPrice) > 0 &&
    repeatClaim !== null;

  const fetchQuote = useCallback(() => {
    if (!startDate || Number(capacity) <= 0 || Number(ticketPrice) <= 0) {
      setMemo({ kind: "empty" });
      return;
    }
    const seq = ++quoteSeq.current;
    setMemo((prev) =>
      prev.kind === "quote" || prev.kind === "invite" ? prev : { kind: "loading" }
    );
    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        capacity: Number(capacity),
        ticketPrice: Number(ticketPrice),
        shows,
        address,
        firstTime: repeatClaim !== true,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (seq !== quoteSeq.current) return;
        if (typeof data.verificationRequired === "boolean") {
          setVerificationRequired(data.verificationRequired);
        }
        if (data.belowMinimum) setMemo({ kind: "belowMinimum" });
        else if (data.collision)
          setMemo({ kind: "collision", span: data.span, shows });
        else if (data.offerFirst && data.span)
          setMemo({ kind: "invite", span: data.span, shows });
        else if (data.quote)
          setMemo({ kind: "quote", quote: data.quote, span: data.span, shows });
        else setMemo({ kind: "empty" });
      })
      .catch(() => {
        if (seq === quoteSeq.current) setMemo({ kind: "empty" });
      });
  }, [startDate, capacity, ticketPrice, shows, address, repeatClaim]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 400);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  function resetFlow() {
    setIntent(null);
    setOfferReview(false);
    setResult(null);
    setError(null);
  }

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: buyerEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the code");
      setCodeSent(true);
      setDevCode(data.devCode || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkCode() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: buyerEmail, code }),
      });
      const data = await res.json();
      if (!data.verified) throw new Error("That code did not match. Try again.");
      setVerified(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const body: any = {
        kind: intent,
        buyerName,
        buyerEmail,
        buyerPhone,
        venue,
        address,
        capacity: Number(capacity),
        ticketPrice: Number(ticketPrice),
        shows,
        startDate,
        repeatClaim: repeatClaim === true,
      };
      if (intent === "offer") {
        body.offer = {
          guarantee: Number(offerDraft.guarantee),
          doorPct: Number(offerDraft.doorPct) || 0,
          travel: Number(offerDraft.travel) || 0,
          hotel: offerDraft.hotel === "yes",
        };
      }
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (data.declined) setResult({ kind: "declined", message: data.message });
      else setResult({ kind: "received", forOffer: intent === "offer" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const contactComplete =
    buyerName.trim() !== "" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail) &&
    buyerPhone.trim().length >= 7;

  const offerComplete =
    intent !== "offer" || Number(offerDraft.guarantee) > 0;

  const memoReady = memo.kind === "quote" || memo.kind === "invite";
  const span = spanDaysForShows(shows);

  return (
    <div className="shell">
      <header className="masthead">
        <h1>John Heffron</h1>
        <div className="cred">
          Winner · NBC&apos;s Last Comic Standing&nbsp;&nbsp;·&nbsp;&nbsp;37 Years on Stage
        </div>
        <div className="officeNote">
          Private booking calendar. All terms issued by the office.
        </div>
      </header>

      <div className="columns">
        {/* BUYER INPUTS */}
        <div className="panel">
          <div className="panelTitle">Pick your dates</div>
          <Calendar
            selectedStart={startDate}
            spanDays={span}
            onSelect={(d) => {
              setStartDate(d);
              resetFlow();
            }}
          />
          <div className="calHint">
            Selecting a start date holds {span} day{span > 1 ? "s" : ""} for a{" "}
            {shows}-show engagement. HELD dates are unavailable.
          </div>

          <div className="panelTitle sectionGap">Tell us about your room</div>
          <div className="field">
            <label>Club / venue name</label>
            <input
              value={venue}
              placeholder="e.g. The Comedy Attic"
              onChange={(e) => {
                setVenue(e.target.value);
                resetFlow();
              }}
            />
          </div>
          <div className="field">
            <label>Venue address or zip</label>
            <input
              value={address}
              placeholder="e.g. 123 Main St, Grand Rapids, MI"
              onChange={(e) => {
                setAddress(e.target.value);
                resetFlow();
              }}
            />
          </div>
          <div className="field">
            <label>Seating capacity</label>
            <input
              inputMode="numeric"
              value={capacity}
              placeholder="250"
              onChange={(e) => {
                setCapacity(e.target.value.replace(/[^\d]/g, ""));
                resetFlow();
              }}
            />
          </div>
          <div className="field">
            <label>Ticket price ($)</label>
            <input
              inputMode="decimal"
              value={ticketPrice}
              placeholder="25"
              onChange={(e) => {
                setTicketPrice(e.target.value.replace(/[^\d.]/g, ""));
                resetFlow();
              }}
            />
          </div>
          <div className="field">
            <label>Number of shows</label>
            <select
              value={shows}
              onChange={(e) => {
                setShows(Number(e.target.value));
                resetFlow();
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "show" : "shows"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Booked John before?</label>
            <select
              value={repeatClaim === null ? "" : repeatClaim ? "yes" : "no"}
              onChange={(e) => {
                setRepeatClaim(e.target.value === "" ? null : e.target.value === "yes");
                resetFlow();
              }}
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="no">First time</option>
              <option value="yes">Yes, we&apos;ve worked together</option>
            </select>
          </div>
        </div>

        {/* THE DEAL MEMO */}
        <div>
          <DealMemo
            state={memo}
            intent={intent}
            result={result}
            roomComplete={roomComplete}
            offerDraft={offerDraft}
            offerReview={offerReview}
            offerSummary={{ venue, buyerName, buyerEmail, buyerPhone }}
            busy={busy}
            sendError={error}
            onOfferDraft={setOfferDraft}
            onRequest={() => setIntent("request")}
            onStartOffer={() => setIntent("offer")}
            onBackFromOffer={() => setIntent(null)}
            onSendOffer={submit}
            onEditOffer={() => setOfferReview(false)}
            onResultBack={resetFlow}
          />

          {intent !== null && !result && !offerReview && (
            <section className="panel" style={{ marginTop: 24 }}>
              <div className="panelTitle">Your details</div>
              <div className="panelSub">
                The office reviews all requests and responds within 48 hours.
              </div>
              <div className="field">
                <label>Name</label>
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="fieldRow">
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => {
                      setBuyerEmail(e.target.value);
                      setVerified(false);
                      setCodeSent(false);
                    }}
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>

              {verificationRequired && !verified && !codeSent && (
                <button
                  type="button"
                  className="btn gold"
                  style={{ width: "100%", marginTop: 16 }}
                  disabled={!contactComplete || busy}
                  onClick={sendCode}
                >
                  Send verification code
                </button>
              )}

              {verificationRequired && !verified && codeSent && (
                <>
                  <div className="field">
                    <label>6-digit code (sent to your email)</label>
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
                    />
                  </div>
                  {devCode && (
                    <div className="notice">
                      Email delivery is not configured. Your code: {devCode}
                    </div>
                  )}
                  <div className="btnRow">
                    <button
                      type="button"
                      className="btn gold"
                      disabled={code.length !== 6 || busy}
                      onClick={checkCode}
                    >
                      Verify
                    </button>
                    <button type="button" className="btn" disabled={busy} onClick={sendCode}>
                      Resend
                    </button>
                  </div>
                </>
              )}

              {(verified || !verificationRequired) && (
                <button
                  type="button"
                  className="memoCta"
                  disabled={
                    busy ||
                    !memoReady ||
                    !roomComplete ||
                    !offerComplete ||
                    !contactComplete
                  }
                  onClick={intent === "offer" ? () => setOfferReview(true) : submit}
                >
                  {intent === "offer" ? "Review your offer" : "Request these dates"}
                </button>
              )}

              {error && <div className="notice err">{error}</div>}
            </section>
          )}
        </div>
      </div>

      <footer className="footerLinks">
        <a href="/corporate">Corporate &amp; private events</a>
        <a href="/office">The Office</a>
        <span>All engagements subject to Artist approval.</span>
      </footer>
    </div>
  );
}
