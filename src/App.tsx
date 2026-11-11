
import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PrintType = "bw" | "colour";
type PaperSize = "A4" | "A3";
type PrintSide = "single" | "double";
type PageMode = "all" | "custom";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const SUPABASE_URL =
  "https://uurjgzqmiwxqkwyvkheu.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_P8G0y_BaN0StH_Pltew6rA_HkJhHfED";

const UPLOAD_URL =
  `${SUPABASE_URL}/functions/v1/storage-upload`;

const ORDER_URL =
  `${SUPABASE_URL}/functions/v1/create-print-order`;

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);

// PDF individual page preview
function PdfPagePreview({
  pdf,
  pageNumber,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;

    async function renderPage() {
      try {
        const page = await pdf.getPage(pageNumber);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const viewport = page.getViewport({ scale: 0.8 });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber]);

  return (
    <div
      style={{
        background: "#f1f1f1",
        padding: "12px",
        borderRadius: "10px",
        textAlign: "center",
        marginBottom: "12px",
      }}
    >
      <strong style={{ display: "block", marginBottom: "10px" }}>
        Page {pageNumber}
      </strong>

      {loading && <p>Loading page...</p>}
      {error && <p>Preview unavailable for this page.</p>}

      <canvas
        ref={canvasRef}
        style={{
          display: error ? "none" : "block",
          maxWidth: "100%",
          height: "auto",
          margin: "0 auto",
          background: "white",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      />
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocument, setPdfDocument] =
    useState<PDFDocumentProxy | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);

  const [pageMode, setPageMode] = useState<PageMode>("all");
  const [customRange, setCustomRange] = useState("");

  const [paper, setPaper] = useState<PaperSize>("A4");
  const [type, setType] = useState<PrintType>("bw");
  const [side, setSide] = useState<PrintSide>("single");
  const [copies, setCopies] = useState("1");

  const [busy, setBusy] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  const copyCount = Math.min(100, Math.max(1, Number(copies) || 1));

  // Calculate selected pages from All Pages or Custom Range
  const selectedPages = useMemo(() => {
    if (!file) return [];

    // Images have only one printable page
    if (file.type.startsWith("image/")) {
      return [1];
    }

    if (!pdfDocument) return [];

    if (pageMode === "all") {
      return Array.from(
        { length: pdfDocument.numPages },
        (_, index) => index + 1
      );
    }

    const value = customRange.trim();

    // Accept one page number or one range such as 1-4
    const match = value.match(/^(\d+)\s*-\s*(\d+)$/);

    if (!match) return [];

    const start = Number(match[1]);
    const end = Number(match[2]);

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      end > pdfDocument.numPages
    ) {
      return [];
    }

    return Array.from(
      { length: end - start + 1 },
      (_, index) => start + index
    );
  }, [file, pdfDocument, pageMode, customRange]);

  const pageCount = selectedPages.length;

  const rate =
    paper === "A4"
      ? type === "bw" ? 3 : 10
      : type === "bw" ? 6 : 20;

  const total = useMemo(
    () =>
      pageCount *
      copyCount *
      rate *
      (side === "double" ? 2 : 1),
    [pageCount, copyCount, rate, side]
  );

  const imagePreviewUrl = useMemo(() => {
    if (file && file.type.startsWith("image/")) {
      return URL.createObjectURL(file);
    }
    return "";
  }, [file]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  async function choose(f: File | null) {
    setMessage("");
    setOrderNumber("");
    setPdfDocument(null);
    setPreviewOpen(false);
    setPageMode("all");
    setCustomRange("");

    if (!f) {
      setFile(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(f.type)) {
      setFile(null);
      setMessage("PDF, JPG, PNG files only.");
      return;
    }

    if (f.size > 20 * 1024 * 1024) {
      setFile(null);
      setMessage("File size must be 20 MB or less.");
      return;
    }

    setFile(f);

    if (f.type === "application/pdf") {
      setPreviewLoading(true);
      setMessage("Reading PDF pages...");

      try {
        const loadingTask = pdfjsLib.getDocument({
          data: await f.arrayBuffer(),
        });

        const pdf = await loadingTask.promise;

        if (pdf.numPages > 500) {
          await pdf.destroy();
          setFile(null);
          setMessage("Maximum 500 PDF pages are allowed.");
          return;
        }

        setPdfDocument(pdf);
        setMessage("PDF loaded successfully.");
      } catch {
        setFile(null);
        setPdfDocument(null);
        setMessage("Unable to read this PDF. Please try another PDF.");
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setMessage("Image selected successfully.");
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setOrderNumber("");

    if (!file) {
      setMessage("Please choose a PDF or image.");
      return;
    }

    if (previewLoading) {
      setMessage("Please wait until the preview is ready.");
      return;
    }

    if (selectedPages.length === 0) {
      setMessage(
        pageMode === "custom"
          ? `Please enter a valid page range between 1 and ${pdfDocument?.numPages || 1}. Example: 1-4`
          : "No printable pages found."
      );
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(UPLOAD_URL, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadResult.success) {
        throw new Error(
          uploadResult.error || "File upload failed."
        );
      }

      const orderResponse = await fetch(ORDER_URL, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_path: uploadResult.path,
          file_name: file.name,
          paper_size: paper,
          print_type: type,
          print_side: side,
          copies: copyCount,
          total_pages: pageCount,
          selected_pages: selectedPages,
          total_amount: total,
        }),
      });

      const orderResult = await orderResponse.json();

      if (!orderResponse.ok || !orderResult.success) {
        throw new Error(
          orderResult.error || "Order could not be saved."
        );
      }

      setOrderNumber(
        orderResult.order?.order_number ||
        orderResult.order?.id ||
        "Saved"
      );

      setMessage("Order saved successfully!");

      setFile(null);
      setPdfDocument(null);
      setPreviewOpen(false);
      setPageMode("all");
      setCustomRange("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
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
            Upload your file, preview your document,
            choose print settings and collect your prints.
          </p>
        </div>
        <div className="heroIcon">▤</div>
      </section>

      <form onSubmit={submit}>
        <section className="panel">
          <h2>01 <span>Upload document</span></h2>

          <label className="upload">
            <b>＋</b>
            <strong>
              {file ? file.name : "Choose PDF / JPG / PNG"}
            </strong>
            <small>Maximum file size: 20 MB</small>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) =>
                choose(e.target.files?.[0] || null)
              }
            />
          </label>
        </section>

        {file && (
          <section className="panel">
            <h2>02 <span>Document preview</span></h2>

            {previewLoading && (
              <p>Reading document pages...</p>
            )}

            {pdfDocument && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                  onClick={() => setPreviewOpen(!previewOpen)}
                >
                  <div>
                    <strong>PDF Preview</strong>
                    <p className="hint" style={{ margin: "5px 0 0" }}>
                      Total pages: {pdfDocument.numPages}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={previewOpen ? "Close preview" : "Open preview"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewOpen(!previewOpen);
                    }}
                    style={{
                      fontSize: "22px",
                      padding: "5px 12px",
                      cursor: "pointer",
                    }}
                  >
                    {previewOpen ? "▲" : "▼"}
                  </button>
                </div>

                {previewOpen && (
                  <div style={{ marginTop: "15px" }}>
                    {Array.from(
                      { length: pdfDocument.numPages },
                      (_, index) => index + 1
                    ).map((pageNumber) => (
                      <PdfPagePreview
                        key={pageNumber}
                        pdf={pdfDocument}
                        pageNumber={pageNumber}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {imagePreviewUrl && (
              <div
                style={{
                  background: "#f1f1f1",
                  padding: "12px",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <img
                  src={imagePreviewUrl}
                  alt="Uploaded document preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "450px",
                    objectFit: "contain",
                  }}
                />
              </div>
            )}
          </section>
        )}

        {file && (
          <section className="panel">
            <h2>03 <span>Select printer pages</span></h2>

            {pdfDocument && (
              <>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <input
                    type="radio"
                    name="pageMode"
                    checked={pageMode === "all"}
                    onChange={() => setPageMode("all")}
                  />
                  <strong>All Pages</strong>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    type="radio"
                    name="pageMode"
                    checked={pageMode === "custom"}
                    onChange={() => setPageMode("custom")}
                  />
                  <strong>Custom Pages</strong>
                </label>

                {pageMode === "custom" && (
                  <div style={{ marginTop: "15px" }}>
                    <label>
                      Enter page range
                      <input
                        type="text"
                        value={customRange}
                        onChange={(e) =>
                          setCustomRange(e.target.value)
                        }
                        placeholder="Example: 1-4"
                        style={{
                          display: "block",
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "12px",
                          marginTop: "8px",
                        }}
                      />
                    </label>

                    <p className="hint">
                      Example: 1-2, 1-4, 4-8
                    </p>

                    {customRange.trim() !== "" && pageCount === 0 && (
                      <p style={{ color: "red" }}>
                        Invalid range. Enter pages between 1 and {pdfDocument.numPages}.
                      </p>
                    )}

                    {pageCount > 0 && (
                      <p className="hint">
                        Selected pages: {selectedPages[0]}-{selectedPages[selectedPages.length - 1]}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {imagePreviewUrl && (
              <p className="hint">Image document: 1 printable page.</p>
            )}

            <p className="hint">
              Pages selected for printing: {pageCount}
            </p>
          </section>
        )}

        <section className="panel">
          <h2>04 <span>Print settings</span></h2>

          <div className="grid">
            <label>
              Paper size
              <select
                value={paper}
                onChange={(e) =>
                  setPaper(e.target.value as PaperSize)
                }
              >
                <option value="A4">A4</option>
                <option value="A3">A3</option>
              </select>
            </label>

            <label>
              Print colour
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as PrintType)
                }
              >
                <option value="bw">Black & White</option>
                <option value="colour">Colour</option>
              </select>
            </label>

            <label>
              Print sides
              <select
                value={side}
                onChange={(e) =>
                  setSide(e.target.value as PrintSide)
                }
              >
                <option value="single">Single side</option>
                <option value="double">Both sides</option>
              </select>
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
                  const n = Math.min(
                    100,
                    Math.max(1, Number(copies) || 1)
                  );
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

        <section className="panel">
          <h2>05 <span>Order summary</span></h2>

          <div className="grid">
            <div>
              <small>Selected pages</small>
              <strong>{pageCount}</strong>
            </div>

            <div>
              <small>Copies</small>
              <strong>{copyCount}</strong>
            </div>

            <div>
              <small>Paper</small>
              <strong>{paper}</strong>
            </div>

            <div>
              <small>Print type</small>
              <strong>
                {type === "bw" ? "Black & White" : "Colour"}
              </strong>
            </div>

            <div>
              <small>Print sides</small>
              <strong>
                {side === "single" ? "Single side" : "Both sides"}
              </strong>
            </div>

            <div>
              <small>Rate per side</small>
              <strong>{money(rate)}</strong>
            </div>
          </div>

          <p className="hint">
            Selected page numbers:{" "}
            {selectedPages.join(", ") || "None"}
          </p>

          <p className="hint">
            Total chargeable sides:{" "}
            {pageCount * copyCount * (side === "double" ? 2 : 1)}
          </p>
        </section>

        <section className="total">
          <div>
            <small>ESTIMATED TOTAL</small>
            <strong>{money(total)}</strong>
            <small>Shop pickup · Cash Payment at Shop</small>
          </div>

          <button
            type="submit"
            disabled={
              busy ||
              previewLoading ||
              !file ||
              pageCount === 0
            }
          >
            {busy ? "Please wait…" : "Place Order →"}
          </button>
        </section>

        {message && <div className="notice">{message}</div>}

        {orderNumber && (
          <div className="notice">
            <strong>Your Order Number:</strong>
            <p>{orderNumber}</p>
            <small>Your order details have been saved.</small>
          </div>
        )}
      </form>

      <footer>
        CLICK SOLUTIONS QR PRINT & XEROX
        <span>Need help? Contact the shop.</span>
      </footer>

      <div className="setup">
        File upload and order saving are activated.
        Payment and automatic printing are not activated yet.
      </div>
    </main>
  );
}
