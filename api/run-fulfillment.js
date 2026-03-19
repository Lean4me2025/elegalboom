import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export default async function handler(req, res) {
  console.log("🔥 FUNCTION STARTED");

  try {
    // 🔹 INPUT
    const raw_order_id =
      req.query?.order_id ||
      req.body?.order_id;

    const order_id = raw_order_id?.trim();

    console.log("🚀 order_id:", order_id);

    if (!order_id) {
      return res.status(400).json({
        error: "Missing order_id"
      });
    }

    // 🔥 HARDCODED SUPABASE (TEMP)
    const SUPABASE_URL = "https://vvjbjfltqsivvxxifnvi.supabase.co";
    const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2amJqZmx0cXNpdnZ4eGlmbnZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3NjM1MCwiZXhwIjoyMDczNTUyMzUwfQ.y1rOHt59kVEor5gX8Wz1OGpq26xDICCM8n_T_nuVaYs";

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    console.log("🔌 Supabase connected");

    // 🔹 FETCH ORDER
    const { data, error: fetchError } = await supabase
      .from('pweb_orders')
      .select('*')
      .eq('order_id', order_id);

    if (fetchError) {
      console.error("❌ Fetch error:", fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    const order = data?.[0];

    if (!order) {
      console.error("❌ Order not found");
      return res.status(404).json({ error: "Order not found" });
    }

    console.log("✅ Order found:", order.order_id);

    // 🔹 INTAKE
    const intake = order.intake_json || {};

    // 🔹 BUILD DOCUMENT TEXT
    const documentText = `
PROMISSORY NOTE

Date: ${intake.pn_start_date || "N/A"}

Lender: ${intake.pn_lender_name || ""}
Borrower: ${intake.pn_borrower_name || ""}

Amount: $${intake.pn_principal_amount || order.order_notes || ""}
Maturity Date: ${intake.pn_maturity_date || ""}

The Borrower promises to repay the Lender the above amount.

Borrower Signature: _______________________

Lender Signature: _______________________
`;

    console.log("📄 Document built");

    // 🔹 CREATE PDF
    let pdfBytes;

    try {
      console.log("📄 Creating PDF...");

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      let y = 750;
      const lines = documentText.split('\n');

      for (const line of lines) {
        page.drawText(line, {
          x: 40,
          y,
          size: 12,
          font,
        });
        y -= 18;
      }

      pdfBytes = await pdfDoc.save();

      console.log("✅ PDF created");

    } catch (pdfError) {
      console.error("❌ PDF ERROR:", pdfError);
      return res.status(500).json({
        error: "PDF generation failed",
        details: pdfError.message
      });
    }

    // 🔹 UPLOAD TO STORAGE
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

    // 🔹 UPDATE DATABASE (ONLY REAL COLUMNS)
    const { error: updateError } = await supabase
      .from('pweb_orders')
      .update({
        pdf_path: filePath,
        order_status: "document_created",
        fulfilled_at: new Date().toISOString()
      })
      .eq('order_id', order_id);

    if (updateError) {
      console.error("❌ Update error:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    console.log("✅ Database updated");

    return res.status(200).json({
      success: true,
      order_id,
      pdf_path: filePath
    });

  } catch (err) {
    console.error("🔥 HARD CRASH:", err);

    return res.status(500).json({
      error: "Unexpected failure",
      details: err.message
    });
  }
}
