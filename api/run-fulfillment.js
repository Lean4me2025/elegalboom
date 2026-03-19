import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export default async function handler(req, res) {
  try {
    // ✅ ORDER ID INPUT (query + body safe)
    const order_id =
      req.query.order_id ||
      req.body?.order_id;

    console.log("🚀 Incoming order_id:", order_id);

    if (!order_id) {
      return res.status(400).json({
        error: "Missing order_id",
        query: req.query,
        body: req.body
      });
    }

    // 🔥 HARDCODED SUPABASE (TEMP)
    const SUPABASE_URL = "https://vvjbjfltqsivvxxifnvi.supabase.co";
    const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2amJqZmx0cXNpdnZ4eGlmbnZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3NjM1MCwiZXhwIjoyMDczNTUyMzUwfQ.y1rOHt59kVEor5gX8Wz1OGpq26xDICCM8n_T_nuVaYs";

    );

    console.log("🔍 Fetching order...");

    // ✅ GET ORDER
    const { data: order, error: fetchError } = await supabase
      .from('pweb_orders')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (fetchError || !order) {
      console.error("❌ Order fetch error:", fetchError);
      return res.status(400).json({ error: "Order not found" });
    }

    console.log("✅ Order found:", order.order_id);

    const intake = order.intake_json || {};

    // ================================
    // 🧠 LEGAL TEMPLATE (PROMISSORY NOTE)
    // ================================
    const documentText = `
PROMISSORY NOTE

This Promissory Note (“Note”) is made on ${intake.pn_start_date || "the date of execution"}, 
by and between ${intake.pn_lender_name || "Lender"} (“Lender”) and 
${intake.pn_borrower_name || "Borrower"} (“Borrower”).

FOR VALUE RECEIVED, the Borrower promises to pay to the order of the Lender 
the principal sum of $${intake.pn_principal_amount || order.order_notes || "0"}.

1. PAYMENT TERMS  
The Borrower shall repay the loan in full on or before ${intake.pn_maturity_date || "the agreed maturity date"}.

2. INTEREST  
${intake.pn_interest_rate
  ? `This Note shall bear interest at a rate of ${intake.pn_interest_rate}% per annum.`
  : "This Note shall not bear interest."}

3. COLLATERAL  
${intake.pn_collateral
  ? `This Note is secured by the following collateral: ${intake.pn_collateral}.`
  : "This Note is unsecured."}

4. DEFAULT  
If the Borrower fails to make payment when due, the Lender may declare the entire balance immediately due and payable.

5. GOVERNING LAW  
This Note shall be governed by the laws of the State of ${intake.state || "the applicable jurisdiction"}.

IN WITNESS WHEREOF, the parties have executed this Promissory Note as of the date first written above.


______________________________  
Borrower: ${intake.pn_borrower_name || ""}


______________________________  
Lender: ${intake.pn_lender_name || ""}
`;

    console.log("📄 Legal document created");

    // ================================
    // 🧾 CREATE PDF
    // ================================
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const { width, height } = page.getSize();

    const fontSize = 12;
    const lineHeight = 18;

    let y = height - 40;

    const lines = documentText.split('\n');

    for (const line of lines) {
      page.drawText(line, {
        x: 40,
        y: y,
        size: fontSize,
        font: font,
      });
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();

    console.log("✅ PDF created");

    // ================================
    // 📦 UPLOAD TO STORAGE
    // ================================
    const filePath = `documents/${order_id}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    console.log("📦 Uploaded to storage:", filePath);

    // ================================
    // 🗄 UPDATE DATABASE
    // ================================
    const { error: updateError } = await supabase
      .from('pweb_orders')
      .update({
        generated_document: documentText,
        pdf_path: filePath,
        order_status: "document_created",
      })
      .eq('order_id', order_id);

    if (updateError) {
      console.error("❌ DB update error:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    console.log("✅ Database updated");

    return res.status(200).json({
      success: true,
      order_id,
      pdf_path: filePath
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    return res.status(500).json({ error: err.message });
  }
}
