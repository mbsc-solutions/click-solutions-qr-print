
import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

type PrintType = "bw" | "colour";
type PaperSize = "A4" | "A3";
type PrintSide = "single" | "double";

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

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocument, setPdfDocument] =
    useState<PDFDocumentProxy | null>(null);

  const [paper, setPaper] = useState<PaperSize>("A4");
  const [type, setType] = useState<PrintType>("bw");
  const [side, setSide] = useState<PrintSide>("single");
  const [copies, setCopies] = useState("1");
  const [pages, setPages] = useState("1");

  const [busy, setBusy] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pageCount = Math.min(500, Math.max(1, Number(pages) || 1));
  const copyCount = Math.min(100, Math.max(1, Number(copies) || 1));

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

  // Render first PDF page in preview
  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    async function renderPreview() {
      try {
        const page = await pdfDocument!.getPage(1);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const viewport = page.getViewport({ scale: 1.3 });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });

        await (renderTask as any).promise;
      } catch {
        if (!cancelled) {
          setMessage("PDF preview could not be displayed.");
        }
      }
    }

    renderPreview();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDocument]);

  // Select and read file
  async function choose(f: File | null) {
    setMessage("");
    setOrderNumber("");
    setPdfDocument(null);
    setPages("1");

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
        setPages(String(pdf.numPages));
        setMessage("PDF loaded successfully.");
      } catch {
        setFile(null);
        setPdfDocument(null);
        setMessage("Unable to read this PDF. Please try another PDF.");
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPages("1");
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

    setBusy(true);

    try {
      // Step 1: Upload document
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

      // Step 2: Save order details
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
      setPages("1");
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
                    background: "#f1f1f1",
                    padding: "12px",
                    borderRadius: "10px",
                    textAlign: "center",
                    overflow: "auto",
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      background: "white",
                    }}
                  />
                </div>
                <p className="hint">
                  Preview: Page 1 of {pdfDocument.numPages}
                </p>
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

            <p className="hint">
              Total document pages detected: <strong>{pageCount}</strong>
            </p>
          </section>
        )}

        <section className="panel">
          <h2>03 <span>Print settings</span></h2>

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
            Pages are detected automatically from PDF.
            Images count as 1 page.
          </p>

          <p className="hint">
            A4 B&W ₹3 per side · A4 Colour ₹10 per side.
            A3 B&W ₹6 per side · A3 Colour ₹20 per side.
            Both sides are charged for two printed sides.
          </p>
        </section>

        <section className="panel">
          <h2>04 <span>Order summary</span></h2>

          <div className="grid">
            <div>
              <small>Document pages</small>
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
            Total chargeable sides: {pageCount * copyCount * (side === "double" ? 2 : 1)}
          </p>
        </section>

        <section className="total">
          <div>
            <small>ESTIMATED TOTAL</small>
            <strong>{money(total)}</strong>
            <small>Shop pickup · Payment at shop</small>
          </div>

          <button
            type="submit"
            disabled={busy || previewLoading || !file}
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
