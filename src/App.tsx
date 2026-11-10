import { useMemo, useState } from "react";

type PrintType="bw"|"colour";
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n);
export default function App(){
 const [file,setFile]=useState<File|null>(null),[name,setName]=useState(""),[phone,setPhone]=useState("");
 const [paper,setPaper]=useState("A4"),[type,setType]=useState<PrintType>("bw"),[side,setSide]=useState("single"),[copies,setCopies]=useState(1),[pages,setPages]=useState(1);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const rate=paper==="A4"?(type==="bw"?3:10):(type==="bw"?6:20);
 const total=useMemo(()=>pages*copies*rate*(side==="double"?0.6:1),[pages,copies,rate,side]);
 function choose(f:File|null){if(!f)return; if(!["application/pdf","image/jpeg","image/png"].includes(f.type)){setMessage("PDF, JPG, PNG files only.");return;} if(f.size>20*1024*1024){setMessage("File size must be 20 MB or less.");return;} setFile(f);setMessage("");}
 async function submit(e:React.FormEvent){e.preventDefault();setMessage("");
  if(!file){setMessage("Please choose a PDF or image.");return;}
  if(!/^[6-9]\d{9}$/.test(phone)){setMessage("Enter a valid 10-digit Indian mobile number.");return;}
  setBusy(true);
  try{
   // Backend is intentionally not called until secure Supabase Edge Functions
   // and Razorpay verification have been deployed and tested.
   setMessage("Customer portal UI is ready, but online ordering is not activated yet. The secure order-upload and Razorpay backend must be configured before accepting real orders.");

  }catch(err){setMessage(err instanceof Error?err.message:"Order could not be submitted.");}
  finally{setBusy(false);}
 }
 return <main><header><div className="logo">CLICK <span>SOLUTIONS</span></div><div className="sub">QR PRINT & XEROX</div><p>UPLOAD · PRINT · PAY · COLLECT</p></header>
 <section className="hero"><div><small>ONLINE PRINT ORDER</small><h1>Your documents,<br/><em>printed with ease.</em></h1><p>Upload your file, choose print settings and pay online. Collect your ready prints from our shop.</p></div><div className="heroIcon">▤</div></section>
 <form onSubmit={submit}><section className="panel"><h2>01 <span>Customer details</span></h2><div className="grid"><label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label><label>Mobile number<input required inputMode="numeric" maxLength={10} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,""))} placeholder="10-digit mobile number"/></label></div></section>
 <section className="panel"><h2>02 <span>Upload document</span></h2><label className="upload"><b>＋</b><strong>{file?file.name:"Choose PDF / JPG / PNG"}</strong><small>Maximum file size: 20 MB</small><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>choose(e.target.files?.[0]||null)}/></label></section>
 <section className="panel"><h2>03 <span>Print settings</span></h2><div className="grid"><label>Paper size<select value={paper} onChange={e=>setPaper(e.target.value)}><option>A4</option><option>A3</option></select></label><label>Print colour<select value={type} onChange={e=>setType(e.target.value as PrintType)}><option value="bw">Black & White</option><option value="colour">Colour</option></select></label><label>Print sides<select value={side} onChange={e=>setSide(e.target.value)}><option value="single">Single side</option><option value="double">Both sides</option></select></label><label>Pages in document<input type="number" min="1" max="500" value={pages} onChange={e=>setPages(Math.max(1,Math.min(500,Number(e.target.value)||1)))}/></label><label>Number of copies<input type="number" min="1" max="100" value={copies} onChange={e=>setCopies(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label></div><p className="hint">A3 rate is a provisional estimate (B&W ₹6 / colour ₹20 per page). Final amount may be adjusted by the shop before printing. Double-sided estimate uses 60% of single-side page rate.</p></section>
 <section className="total"><div><small>ESTIMATED TOTAL</small><strong>{money(total)}</strong><small>Shop pickup · Payment online</small></div><button disabled={busy}>{busy?"Please wait…":"Continue to secure payment →"}</button></section>
 {message&&<div className="notice">{message}</div>}</form>
 <footer>CLICK SOLUTIONS QR PRINT & XEROX <span>Need help? Contact the shop.</span></footer>
 {!configured&&<div className="setup">Setup required: add Supabase project URL and publishable/anon key to Vercel. Do not put service-role or Razorpay secret keys in this website.</div>}
 </main>
}
