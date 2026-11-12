
import { useState } from "react";
import { supabase } from "./supabase";

type PrintType = "bw" | "colour";
type PaperSize = "A4" | "A3";
type PrintSide = "single" | "double";
type PaymentMethod = "online" | "cash";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [paper, setPaper] = useState<PaperSize>("A4");
  const [type, setType] = useState<PrintType>("bw");
  const [side, setSide] = useState<PrintSide>("single");
  const [copies, setCopies] = useState(1);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [pageMode, setPageMode] = useState<"all" | "custom">("all");
  const [customPages, setCustomPages] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const rate =
    paper === "A4"
      ? type === "bw" ? 3 : 10
      : type === "bw" ? 6 : 20;

  async function submitOrder() {
    if (!file) {
      setMessage("Please select a PDF or image file.");
      return;
    }

    if (copies < 1 || copies > 100) {
      setMessage("Copies must be between 1 and 100.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      let totalPages = 1;
      let selectedPages = [1];

      if (file.type === "application/pdf") {
        const pdfjs = await import("pdfjs-dist");
        const pdf = await pdfjs.getDocument(
          { data: await file.arrayBuffer() },
        ).promise;

        totalPages = pdf.numPages;

        if (pageMode === "all") {
          selectedPages = Array.from(
            { length: totalPages },
            (_, i) => i + 1,
          );
        } else {
          const pages: number[] = [];

          for (const part of customPages.split(",")) {
            const value = part.trim();

            if (/^\d+-\d+$/.test(value)) {
              const [start, end] = value.split("-").map(Number);

              if (start < 1 || end > totalPages || start > end) {
                throw new Error("Invalid page range.");
              }

              for (let p = start; p <= end; p++) pages.push(p);
            } else if (/^\d+$/.test(value)) {
              const p = Number(value);
              if (p < 1 || p > totalPages) {
                throw new Error("Invalid page number.");
              }
              pages.push(p);
            } else {
              throw new Error("Enter pages like 1-3,5,7-9.");
            }
          }

          selectedPages = [...new Set(pages)].sort((a, b) => a - b);
        }
      }

      if (selectedPages.length === 0) {
        throw new Error("Select at least one page.");
      }

      const total = selectedPages.length * copies * rate *
        (side === "double" ? 2 : 1);

      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!["pdf", "jpg", "jpeg", "png"].includes(extension)) {
        throw new Error("Only PDF, JPG and PNG files are allowed.");
      }

      const filePath =
        `orders/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("orders")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: orderResult, error: orderError } =
        await supabase.functions.invoke("create-print-order", {
          body: {
            file_path: filePath,
            file_name: file.name,
            paper_size: paper,
            print_type: type,
            print_side: side,
            copies,
            total_pages: selectedPages.length,
            selected_pages: selectedPages,
            total_amount: total,
            payment_method: paymentMethod,
          },
        });

      if (orderError) {
        throw new Error(
          orderResult
            ? JSON.stringify(orderResult, null, 2)
            : orderError.message,
        );
      }

      if (!orderResult?.success) {
        throw new Error(JSON.stringify(orderResult, null, 2));
      }

      setMessage(
        `Order placed successfully! Order number: ${
          orderResult.order?.order_number ?? orderResult.order?.id
        }. Total: ₹${total}`,
      );

      setFile(null);
      setCopies(1);
      setCustomPages("");
      setPageMode("all");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Order failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      maxWidth: 520,
      margin: "30px auto",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <h1>CLICK SOLUTIONS</h1>
      <h2>QR Print & Xerox</h2>

      <label>Choose PDF or Image</label>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <p>Paper Size</p>
      <select
        value={paper}
        onChange={(e) => setPaper(e.target.value as PaperSize)}
      >
        <option value="A4">A4</option>
        <option value="A3">A3</option>
      </select>

      <p>Print Type</p>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as PrintType)}
      >
        <option value="bw">Black & White</option>
        <option value="colour">Colour</option>
      </select>

      <p>Print Side</p>
      <select
        value={side}
        onChange={(e) => setSide(e.target.value as PrintSide)}
      >
        <option value="single">Single Side</option>
        <option value="double">Double Side</option>
      </select>

      <p>Copies</p>
      <input
        type="number"
        min="1"
        max="100"
        value={copies}
        onChange={(e) => setCopies(Number(e.target.value))}
      />

      <p>Pages</p>
      <label>
        <input
          type="radio"
          checked={pageMode === "all"}
          onChange={() => setPageMode("all")}
        />
        All Pages
      </label>

      <label>
        <input
          type="radio"
          checked={pageMode === "custom"}
          onChange={() => setPageMode("custom")}
        />
        Custom Pages
      </label>

      {pageMode === "custom" && (
        <input
          type="text"
          placeholder="Example: 1-3,5,7-9"
          value={customPages}
          onChange={(e) => setCustomPages(e.target.value)}
        />
      )}

      <p>Payment Method</p>
      <label>
        <input
          type="radio"
          checked={paymentMethod === "online"}
          onChange={() => setPaymentMethod("online")}
        />
        PhonePe / UPI
      </label>

      <label>
        <input
          type="radio"
          checked={paymentMethod === "cash"}
          onChange={() => setPaymentMethod("cash")}
        />
        Cash at Shop
      </label>

      <h3>
        Total: ₹
        {(
          (file ? 1 : 0) *
          copies *
          rate
        ).toFixed(2)}
        {" "}per selected page
      </h3>

      <button
        onClick={submitOrder}
        disabled={loading || !file}
        style={{
          padding: "12px 24px",
          background: "#1565c0",
          color: "white",
          border: 0,
          cursor: "pointer",
          borderRadius: 6,
        }}
      >
        {loading ? "Submitting..." : "Place Print Order"}
      </button>

      {message && (
        <pre style={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          marginTop: 20,
          padding: 12,
          background: "#f1f1f1",
        }}>
          {message}
        </pre>
      )}
    </main>
  );
}
