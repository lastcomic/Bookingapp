"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Calendar from "@/components/Calendar";
import DealMemo, { MemoState } from "@/components/DealMemo";
import { spanDaysForShows } from "@/lib/dates";

type Intent = null | "request" | "offer";

export default function BookingPage() {
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

  // Intent + offer terms
  const [intent, setIntent] = useState<Intent>(null);
  const [offerGuarantee, setOfferGuarantee] = useState("");
  const [offerDoorPct, setOfferDoorPct] = useState("");
  const [offerTravel, setOfferTravel] = useState("");
  const [offerHotel, setOfferHotel] = useState<boolean | null>(null);

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
  const [done, setDone] = useState<string | null>(null);
  const [declined, setDeclined] = useState<string | null>(null);

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
    setMemo((prev) => (prev.kind === "quote" ? prev : { kind: "loading" }));
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
        if (data.belowMinimum) setMemo({ kind: "belowMinimum" });
        else if (data.collision) setMemo({ kind: "collision", span: data.span });
        else if (data.quote)
          setMemo({
            kind: "quote",
            quote: data.quote,
            span: data.span,
            venue: venue.trim(),
            shows,
          });
        else setMemo({ kind: "empty" });
      })
      .catch(() => {
        if (seq === quoteSeq.current) setMemo({ kind: "empty" });
      });
  }, [startDate, capacity, ticketPrice, shows, address, repeatClaim, venue]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 400);
    return () => clearTimeout(t);
  }, [fetchQuote]);

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
          guarantee: Number(offerGuarantee),
          doorPct: Number(offerDoorPct) || 0,
          travel: Number(offerTravel) || 0,
          hotel: offerHotel === true,
        };
      }
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (data.declined) setDeclined(data.message);
      else setDone(data.message);
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
    intent !== "offer" ||
    (Number(offerGuarantee) > 0 && offerHotel !== null);

  const memoReady = memo.kind === "quote";

  return (
    <div className="shell">
      <header className="masthead">
        <h1>John Heffron</h1>
        <div className="cred">
          Winner · NBC&apos;s Last Comic Standing · 37 Years on Stage
        </div>
        <div className="officeNote">
          Private booking calendar. All terms issued by the office.
        </div>
      </header>

      {done || declined ? (
        <section className="panel" style={{ maxWidth: 560 }}>
          <div className="panelTitle">{declined ? "Regarding your offer" : "Received"}</div>
          <p style={{ marginTop: 8 }}>
            {declined ||
              "Your request is with the office. " + done}
          </p>
          {declined && (
            <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
              To proceed on standard terms, refresh this page and request the
              dates directly.
            </p>
          )}
        </section>
      ) : (
        <div className="columns">
          <div>
            <section className="panel">
              <div className="panelTitle">Open Dates</div>
              <div className="panelSub">
                Select a start date. The engagement span holds automatically
                based on your show count.
              </div>
              <Calendar
                selectedStart={startDate}
                spanDays={spanDaysForShows(shows)}
                onSelect={setStartDate}
              />
            </section>

            <section className="panel">
              <div className="panelTitle">Your Room</div>
              <div className="panelSub">
                Terms are prepared for your room as entered.
              </div>
              <div className="field">
                <label>Club / venue name</label>
                <input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="The Comedy Attic"
                />
              </div>
              <div className="field">
                <label>Venue address or zip</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Grand Rapids, MI"
                />
              </div>
              <div className="fieldRow">
                <div className="field">
                  <label>Seating capacity</label>
                  <input
                    inputMode="numeric"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="250"
                  />
                </div>
                <div className="field">
                  <label>Ticket price ($)</label>
                  <input
                    inputMode="decimal"
                    value={ticketPrice}
                    onChange={(e) =>
                      setTicketPrice(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    placeholder="25"
                  />
                </div>
              </div>
              <div className="field">
                <label>Number of shows</label>
                <select value={shows} onChange={(e) => setShows(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "show" : "shows"} ·{" "}
                      {spanDaysForShows(n)}-day engagement
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Booked John before?</label>
                <div className="radioRow">
                  <button
                    type="button"
                    className={repeatClaim === false ? "on" : ""}
                    onClick={() => setRepeatClaim(false)}
                  >
                    First time
                  </button>
                  <button
                    type="button"
                    className={repeatClaim === true ? "on" : ""}
                    onClick={() => setRepeatClaim(true)}
                  >
                    Yes, we&apos;ve worked together
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="memoColumn">
            <DealMemo state={memo} />

            {intent === null && (
              <>
                <button
                  type="button"
                  className="ctaPrimary"
                  disabled={!memoReady || !roomComplete}
                  onClick={() => setIntent("request")}
                >
                  Request these dates
                </button>
                <button
                  type="button"
                  className="ctaGhost"
                  disabled={!memoReady || !roomComplete}
                  onClick={() => setIntent("offer")}
                >
                  Working with a different budget structure? Submit your offer.
                </button>
              </>
            )}

            {intent === "offer" && (
              <section className="panel" style={{ marginTop: 16 }}>
                <div className="panelTitle">Your Offer</div>
                <div className="panelSub">
                  Dates and room details carry over automatically.
                </div>
                <div className="fieldRow">
                  <div className="field">
                    <label>Guarantee ($)</label>
                    <input
                      inputMode="numeric"
                      value={offerGuarantee}
                      onChange={(e) =>
                        setOfferGuarantee(e.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder="3000"
                    />
                  </div>
                  <div className="field">
                    <label>Door %, if any</label>
                    <input
                      inputMode="numeric"
                      value={offerDoorPct}
                      onChange={(e) =>
                        setOfferDoorPct(e.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="fieldRow">
                  <div className="field">
                    <label>Travel ($)</label>
                    <input
                      inputMode="numeric"
                      value={offerTravel}
                      onChange={(e) =>
                        setOfferTravel(e.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="field">
                    <label>Hotel provided</label>
                    <div className="radioRow">
                      <button
                        type="button"
                        className={offerHotel === true ? "on" : ""}
                        onClick={() => setOfferHotel(true)}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className={offerHotel === false ? "on" : ""}
                        onClick={() => setOfferHotel(false)}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {intent !== null && (
              <section className="panel" style={{ marginTop: 16 }}>
                <div className="panelTitle">Your Details</div>
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

                {!verified && !codeSent && (
                  <button
                    type="button"
                    className="btn gold"
                    style={{ width: "100%" }}
                    disabled={!contactComplete || busy}
                    onClick={sendCode}
                  >
                    Send verification code
                  </button>
                )}

                {!verified && codeSent && (
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

                {verified && (
                  <button
                    type="button"
                    className="ctaPrimary"
                    disabled={busy || !memoReady || !roomComplete || !offerComplete}
                    onClick={submit}
                  >
                    {intent === "offer" ? "Submit offer" : "Request these dates"}
                  </button>
                )}

                {error && <div className="notice err">{error}</div>}

                <button
                  type="button"
                  className="ctaGhost"
                  onClick={() => {
                    setIntent(null);
                    setError(null);
                  }}
                >
                  Back
                </button>
              </section>
            )}
          </div>
        </div>
      )}

      <footer className="footerLinks">
        <a href="/corporate">Corporate &amp; private events</a>
        <span>All engagements subject to Artist approval.</span>
      </footer>
    </div>
  );
}
