# CLICK SOLUTIONS QR PRINT & XEROX — GitHub Pages frontend

This repository deploys the customer-facing Vite + React website to GitHub Pages.

## Publish on GitHub Pages
1. Create a GitHub repository, e.g. `click-solutions-qr-print`.
2. Upload all files and folders in this project to the repository root.
3. Commit to the `main` branch.
4. Open **Settings → Pages**.
5. Under **Build and deployment → Source**, choose **GitHub Actions**.
6. Open the **Actions** tab. The workflow builds and deploys the site. After it succeeds, GitHub shows the published URL under Settings → Pages.

The included workflow deploys on every push to `main`. Keep the workflow file at `.github/workflows/deploy.yml`.

## Included in this frontend
- PDF/JPG/PNG file picker UI (20 MB browser-side limit)
- Customer name and mobile form
- A4/A3, B&W/colour, single/double side
- Copies and page count inputs
- Estimate display
- Shop pickup messaging
- Responsive orange/black branded layout

## Pricing
Confirmed A4 prices from the owner: B&W ₹3/page and colour ₹10/page.
A3 amounts currently shown (B&W ₹6, colour ₹20) are provisional and need confirmation.
Double-side estimate uses a provisional 60% multiplier; confirm actual shop pricing before launch.

## IMPORTANT — not live ordering/payment yet
GitHub Pages is static hosting. It cannot securely run payment secrets or server-side verification. The current form deliberately does NOT upload customer files, create real orders, or take payments. Do not advertise it as a live order portal yet.

Before launch, deploy secure Supabase Edge Functions (server-side) and configure:
- order creation with server-side file validation, PDF page-count inspection and price calculation
- private `print-documents` bucket upload using a signed upload URL / scoped token
- Razorpay order creation using server-side Razorpay Key Secret
- server-side payment signature verification and signed webhook verification
- idempotent payment/order state transitions
- RLS: anonymous users must not list/read orders or other customers' files; admin-only order access
- admin dashboard and order notifications

Never place Supabase service-role key, database password, Razorpay Key Secret, or webhook secret in GitHub Pages source, GitHub Actions frontend build variables, or any variable prefixed `VITE_`. Only public/publishable keys belong in frontend code.

The project can later use a custom domain and a QR code pointing to the GitHub Pages URL.
