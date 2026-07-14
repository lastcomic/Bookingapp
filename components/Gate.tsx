"use client";

import { useState } from "react";

// The landing page buyers hit before the calendar: private, one field.
export default function Gate() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That code was not recognized.");
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="masthead">
        <h1>John Heffron</h1>
        <div className="cred">
          Winner · NBC&apos;s Last Comic Standing&nbsp;&nbsp;·&nbsp;&nbsp;37 Years on Stage
        </div>
      </header>

      <div style={{ maxWidth: 460, margin: "48px auto 0" }}>
        <div className="memo">
          <div className="memoHead">OFFICE OF JOHN HEFFRON · PRIVATE CALENDAR</div>
          <hr className="rule" />
          <div className="memoBody" style={{ marginBottom: 14 }}>
            Booking dates on this calendar are available by access code from
            the office.
          </div>
          <div className="paperField">
            <label htmlFor="gateCode">Access code</label>
            <input
              id="gateCode"
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && code && !busy && enter()}
            />
          </div>
          <button
            type="button"
            className="memoCta"
            disabled={!code || busy}
            onClick={enter}
          >
            View open dates
          </button>
          {error && (
            <div className="finePaper" style={{ color: "var(--stamp)", marginTop: 10 }}>
              {error}
            </div>
          )}
          <div className="finePaper" style={{ marginTop: 14 }}>
            Corporate &amp; private events: contact the office directly.
          </div>
        </div>
      </div>

      <footer className="footerLinks">
        <a href="/office">The Office</a>
        <span>All engagements subject to Artist approval.</span>
      </footer>
    </div>
  );
}
