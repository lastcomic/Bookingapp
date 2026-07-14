"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatSpan } from "@/lib/dates";

type Item = {
  id: number;
  kind: "request" | "offer";
  status: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  venue: string;
  address: string;
  capacity: number;
  ticket_price: number;
  shows: number;
  start_date: string;
  end_date: string;
  repeat_claim: boolean;
  repeat_verified: boolean;
  drive_minutes: number | null;
  quote: {
    guarantee: number;
    doorPct: number;
    selloutBonus: number;
    travelBuyout: number;
    walkoutPotential: number;
    isDrive: boolean;
    depositPct: number;
  };
  offer: { guarantee: number; doorPct: number; travel: number; hotel: boolean } | null;
  created_at: string;
};

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function OfficeInner() {
  const params = useSearchParams();
  const highlightId = Number(params.get("item")) || null;

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"inbox" | "settings" | "venues">("inbox");
  const [items, setItems] = useState<Item[]>([]);
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [venuesText, setVenuesText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadAll = useCallback(async () => {
    const [inboxRes, settingsRes, venuesRes] = await Promise.all([
      fetch("/api/office/inbox"),
      fetch("/api/office/settings"),
      fetch("/api/office/venues"),
    ]);
    if (inboxRes.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const inbox = await inboxRes.json();
    setItems(inbox.items || []);
    if (settingsRes.ok) setConfig((await settingsRes.json()).config);
    if (venuesRes.ok) setVenuesText(((await venuesRes.json()).venues || []).join("\n"));
  }, []);

  useEffect(() => {
    loadAll().catch(() => setAuthed(false));
  }, [loadAll]);

  async function login() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/office/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Incorrect password");
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(id: number, action: "accept" | "counter" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/office/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    if (!config) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/office/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error("Could not save settings");
      setConfig((await res.json()).config);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveVenues() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const venues = venuesText.split("\n").map((v) => v.trim()).filter(Boolean);
      const res = await fetch("/api/office/venues", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venues }),
      });
      if (!res.ok) throw new Error("Could not save the venue list");
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (authed === null) {
    return (
      <div className="shell">
        <header className="masthead">
          <h1>The Office</h1>
        </header>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="shell">
        <header className="masthead">
          <h1>The Office</h1>
          <div className="cred">John Heffron · Bookings</div>
        </header>
        <section className="panel" style={{ maxWidth: 400 }}>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
          </div>
          <button
            type="button"
            className="ctaPrimary"
            disabled={busy || !password}
            onClick={login}
          >
            Enter
          </button>
          {error && <div className="notice err">{error}</div>}
        </section>
      </div>
    );
  }

  const SETTINGS_FIELDS: [string, string][] = [
    ["homeBase", "Home base"],
    ["driveRadiusHours", "Drive radius (hours)"],
    ["winterRadiusHours", "Winter radius, Nov–Mar (hours)"],
    ["driveFloor4Show", "Drive floor, 4-show weekend ($)"],
    ["flyFloor", "Fly floor ($)"],
    ["flyBuyout", "Air/ground buyout, fly dates ($)"],
    ["guaranteeTargetPct", "Guarantee target (% of gross potential)"],
    ["sanityCapPct", "Sanity cap (% of gross potential)"],
    ["roundTo", "Round guarantee to ($)"],
    ["doorPct", "Door split — the vs (%)"],
    ["selloutBonus", "Sellout bonus per show ($)"],
    ["depositPct", "First-time deposit (%)"],
    ["depositDueHours", "Deposit due (hours after contract)"],
    ["minCapacity", "Minimum capacity (seats)"],
    ["autoDeclinePct", "Auto-decline under (% of quote)"],
  ];

  return (
    <div className="shell">
      <header className="masthead">
        <h1>The Office</h1>
        <div className="cred">John Heffron · Bookings</div>
      </header>

      <div className="tabRow">
        <button className={tab === "inbox" ? "on" : ""} onClick={() => setTab("inbox")}>
          Inbox
        </button>
        <button
          className={tab === "settings" ? "on" : ""}
          onClick={() => setTab("settings")}
        >
          Engine settings
        </button>
        <button className={tab === "venues" ? "on" : ""} onClick={() => setTab("venues")}>
          Past venues
        </button>
      </div>

      {error && <div className="notice err" style={{ marginBottom: 16 }}>{error}</div>}
      {saved && <div className="notice" style={{ marginBottom: 16 }}>Saved.</div>}

      {tab === "inbox" && (
        <div>
          {items.length === 0 && (
            <section className="panel">
              <div className="panelSub" style={{ marginBottom: 0 }}>
                Nothing waiting. New requests and offers land here.
              </div>
            </section>
          )}
          {items.map((item) => {
            const atOrAbove =
              !item.offer || item.offer.guarantee >= item.quote.guarantee;
            const pctOfQuote = item.offer
              ? Math.round((item.offer.guarantee / item.quote.guarantee) * 100)
              : null;
            const pillClass =
              item.status === "new"
                ? "new"
                : item.status === "accepted"
                ? "accepted"
                : item.status === "countered"
                ? "countered"
                : "declined";
            const pillText =
              item.status === "new"
                ? "Pending"
                : item.status === "accepted"
                ? "Accepted → contract"
                : item.status === "countered"
                ? "Countered w/ quote"
                : "Declined";
            return (
              <div
                key={item.id}
                className="offerCard"
                style={
                  highlightId === item.id
                    ? { borderColor: "var(--gold)" }
                    : undefined
                }
              >
                <div className="head">
                  <b className="venueLine">
                    {item.venue} — {item.address}{" "}
                    {item.repeat_claim ? (
                      <span className="repeatNote" style={{ color: "var(--green)" }}>
                        · REPEAT BUYER{!item.repeat_verified && " (UNVERIFIED)"}
                      </span>
                    ) : (
                      <span className="repeatNote" style={{ color: "var(--gold)" }}>
                        · FIRST-TIMER
                      </span>
                    )}
                  </b>
                  <span className={`pill ${pillClass}`}>{pillText}</span>
                </div>
                <div className="meta">
                  Dates: {formatSpan(item.start_date, item.end_date)} ·{" "}
                  {item.kind === "offer" ? "offer" : "date request"}
                  <br />
                  {item.capacity} cap · {money(item.ticket_price)} tix ·{" "}
                  {item.shows} shows
                  {item.drive_minutes !== null &&
                    ` · ${Math.round(item.drive_minutes / 6) / 10} hr drive`}
                  <br />
                  {item.buyer_name} · {item.buyer_email} · {item.buyer_phone}
                  <br />
                  {item.offer ? (
                    <>
                      <b style={{ color: "var(--text)" }}>
                        Their offer: {money(item.offer.guarantee)}
                      </b>
                      {item.offer.doorPct > 0 && <> vs {item.offer.doorPct}%</>} ·
                      travel {money(item.offer.travel)} · hotel{" "}
                      {item.offer.hotel ? "yes" : "no"}
                      <br />
                      <span className={`engineLine ${atOrAbove ? "good" : "low"}`}>
                        Engine would quote: {money(item.quote.guarantee)} (
                        {atOrAbove ? "at/above" : `${pctOfQuote}% of`} your number) ·
                        walkout potential {money(item.quote.walkoutPotential)}
                      </span>
                    </>
                  ) : (
                    <span className="engineLine good">
                      Engine quote: {money(item.quote.guarantee)} vs{" "}
                      {item.quote.doorPct}%
                      {item.quote.travelBuyout > 0 &&
                        ` + ${money(item.quote.travelBuyout)} travel`}{" "}
                      · walkout potential {money(item.quote.walkoutPotential)}
                    </span>
                  )}
                </div>
                {(item.status === "new" || item.status === "countered") && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      className="actBtn accept"
                      disabled={busy}
                      onClick={() => act(item.id, "accept")}
                    >
                      Accept
                    </button>
                    {item.kind === "offer" && item.status === "new" && (
                      <button
                        className="actBtn counter"
                        disabled={busy}
                        onClick={() => act(item.id, "counter")}
                      >
                        Counter w/ engine quote
                      </button>
                    )}
                    <button
                      className="actBtn decline"
                      disabled={busy}
                      onClick={() => act(item.id, "decline")}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "settings" && config && (
        <section className="panel">
          <div className="panelTitle">Engine settings</div>
          <div className="panelSub">
            Server-side only. Buyers never see these values.
          </div>
          <div className="settingsGrid">
            {SETTINGS_FIELDS.map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input
                  value={config[key] ?? ""}
                  inputMode={key === "homeBase" ? "text" : "decimal"}
                  onChange={(e) =>
                    setConfig({ ...config, [key]: e.target.value })
                  }
                />
              </div>
            ))}
            <div className="field">
              <label>Auto-decline low offers</label>
              <div className="radioRow">
                <button
                  type="button"
                  className={config.autoDeclineEnabled ? "on" : ""}
                  onClick={() => setConfig({ ...config, autoDeclineEnabled: true })}
                >
                  On
                </button>
                <button
                  type="button"
                  className={!config.autoDeclineEnabled ? "on" : ""}
                  onClick={() => setConfig({ ...config, autoDeclineEnabled: false })}
                >
                  Off
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="ctaPrimary"
            style={{ maxWidth: 300 }}
            disabled={busy}
            onClick={saveSettings}
          >
            Save settings
          </button>
        </section>
      )}

      {tab === "venues" && (
        <section className="panel">
          <div className="panelTitle">Past venues</div>
          <div className="panelSub">
            One venue per line. A &quot;worked together&quot; claim that does
            not match this list is flagged UNVERIFIED in the inbox — still
            your call.
          </div>
          <div className="field">
            <textarea
              rows={12}
              value={venuesText}
              onChange={(e) => setVenuesText(e.target.value)}
              placeholder={"Comedy Castle — Royal Oak\nZanies — Nashville"}
            />
          </div>
          <button
            type="button"
            className="ctaPrimary"
            style={{ maxWidth: 300 }}
            disabled={busy}
            onClick={saveVenues}
          >
            Save list
          </button>
        </section>
      )}
    </div>
  );
}

export default function OfficePage() {
  return (
    <Suspense>
      <OfficeInner />
    </Suspense>
  );
}
