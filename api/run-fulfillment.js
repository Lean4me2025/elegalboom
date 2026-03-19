import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export default async function handler(req, res) {
  console.log("🔥 FUNCTION STARTED");

  try {
    // 🔹 SAFE INPUT
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

    // 🔹 INIT SUPABASE
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 🔹 FETCH ORDER (NO .single())
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
      return res.status(404).json({ error: "Order not found" });
    }

    console.log("✅ Order found");

    // 🔹 INTAKE
    const intake = order.intake_json || {};

    // 🔹 BUILD TEXT
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

    // 🔹 SAFE PDF GENERATION
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

    // 🔹 UPLOAD
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

    console.log("📦 Uploaded");

    // 🔹 UPDATE DB
    const { error: updateError } = await supabase
      .from('pweb_orders')
      .update({
        generated_document: documentText,
        pdf_path: filePath,
        order_status: "document_created",
      })
      .eq('order_id', order_id);

    if (updateError) {
      console.error("❌ Update error:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    console.log("✅ DONE");

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
