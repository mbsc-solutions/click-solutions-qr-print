
import { useMemo, useState } from "react";

type PrintType = "bw" | "colour";

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [paper, setPaper] = useState("A4");
  const [type, setType] = useState<PrintType>("bw");
  const [side, setSide] = useState("single");
  const [copies, setCopies] = useState("1");
  const [pages, setPages] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const pageCount = Math.max(1, Number(pages) || 1);
  const copyCount = Math.max(1, Number(copies) || 1);

  const rate =
    paper === "A4"
      ? type === "bw" ? 3 : 10
      : type === "bw" ? 6 : 20;

  const total = useMemo(
    () => pageCount * copyCount * rate * (side === "double" ? 2 : 1),
    [pageCount, copyCount, rate, side]
  );

  function choose(f: File | null) {
    if (!f) return;

    if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) {
      setMessage("PDF, JPG, PNG files only.");
      return;
    }

    if (f.size > 20 * 1024 * 1024) {
      setMessage("File size must be 20 MB or less.");
      return;
    }

    setFile(f);
    setMessage("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!file) {
      setMessage("Please choose a PDF or image.");
      return;
    }

    setBusy(true);

    try {
      setMessage(
        "Your print settings are ready. Online ordering and payment are not activated yet."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <div className="logo">
          CLICK <span>SOLUTIONS</span>
        </div>
        <div className="sub">QR PRINT & XEROX</div>
        <p>UPLOAD · PRINT · PAY · COLLECT</p>
      </header>

      <section className="hero">
        <div>
          <small>ONLINE PRINT ORDER</small>
          <h1>
            Your documents,
            <br />
            <em>printed with ease.</em>
          </h1>
          <p>
            Upload your file, choose print settings and pay at our shop.
            Collect your ready prints.
          </p>
        </div>
        <div className="heroIcon">▤</div>
      </section>

      <form onSubmit={submit}>
        <section className="panel">
          <h2>01 <span>Upload document</span></h2>

          <label className="upload">
            <b>＋</b>
            <strong>{file ? file.name : "Choose PDF / JPG / PNG"}</strong>
            <small>Maximum file size: 20 MB</small>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => choose(e.target.files?.[0] || null)}
            />
          </label>
        </section>

        <section className="panel">
          <h2>02 <span>Print settings</span></h2>

          <div className="grid">
            <label>
              Paper size
              <select value={paper} onChange={(e) => setPaper(e.target.value)}>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
              </select>
            </label>

            <label>
              Print colour
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PrintType)}
              >
                <option value="bw">Black & White</option>
                <option value="colour">Colour</option>
              </select>
            </label>

            <label>
              Print sides
              <select value={side} onChange={(e) => setSide(e.target.value)}>
                <option value="single">Single side</option>
                <option value="double">Both sides</option>
              </select>
            </label>

            <label>
              Pages in document
              <input
                type="number"
                min="1"
                max="500"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                onBlur={() => {
                  const n = Math.min(500, Math.max(1, Number(pages) || 1));
                  setPages(String(n));
                }}
              />
            </label>

            <label>
              Number of copies
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
                onBlur={() => {
                  const n = Math.min(100, Math.max(1, Number(copies) || 1));
                  setCopies(String(n));
                }}
              />
            </label>
          </div>

          <p className="hint">
            A4 B&W ₹3 per side · A4 Colour ₹10 per side.
            A3 B&W ₹6 per side · A3 Colour ₹20 per side.
            Both sides are charged for two printed sides.
          </p>
        </section>

        <section className="total">
          <div>
            <small>ESTIMATED TOTAL</small>
            <strong>{money(total)}</strong>
            <small>Shop pickup · Payment at shop</small>
          </div>

          <button disabled={busy}>
            {busy ? "Please wait…" : "Continue →"}
          </button>
        </section>

        {message && <div className="notice">{message}</div>}
      </form>

      <footer>
        CLICK SOLUTIONS QR PRINT & XEROX
        <span>Need help? Contact the shop.</span>
      </footer>

      <div className="setup">
        Online ordering and payment are not activated yet.
      </div>
    </main>
  );
}
