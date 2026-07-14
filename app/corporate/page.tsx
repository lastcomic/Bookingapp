"use client";

import { useState } from "react";

export default function CorporatePage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/corporate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, email, phone, details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setDone(data.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="masthead">
        <h1>John Heffron</h1>
        <div className="cred">Corporate &amp; Private Events</div>
        <div className="officeNote">
          Tell the office about your event. Terms are prepared individually.
        </div>
      </header>

      {done ? (
        <section className="panel" style={{ maxWidth: 560 }}>
          <div className="panelTitle">Received</div>
          <p style={{ marginTop: 8 }}>{done}</p>
        </section>
      ) : (
        <section className="panel" style={{ maxWidth: 560 }}>
          <div className="fieldRow">
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
          <div className="fieldRow">
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Event details — date, city, audience, format</label>
            <textarea
              rows={6}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="ctaPrimary"
            disabled={busy || !name.trim() || !email.trim() || !details.trim()}
            onClick={submit}
          >
            Send to the office
          </button>
          {error && <div className="notice err">{error}</div>}
        </section>
      )}

      <footer className="footerLinks">
        <a href="/">Club &amp; theater dates</a>
      </footer>
    </div>
  );
}
