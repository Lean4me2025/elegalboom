import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

export default async function handler(req, res) {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: "Missing order_id" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("🚀 Running fulfillment for:", order_id);

    // 1️⃣ GET ORDER
    const { data: order, error: fetchError } = await supabase
      .from("pweb_orders")
      .select("*")
      .eq("order_id", order_id)
      .single();

    if (fetchError || !order) {
      console.error("❌ Order fetch error:", fetchError);
      return res.status(400).json({ error: "Order not found" });
    }

    const intake = order.intake_json || {};

    // 2️⃣ BUILD DOCUMENT TEXT (YOUR EXISTING LOGIC CAN GO HERE)
    const documentText = `
PROMISSORY NOTE

Date: ${intake.pn_start_date || "N/A"}

Lender: ${intake.pn_lender_name || ""}
Borrower: ${intake.pn_borrower_name || ""}

Amount: $${intake.pn_principal_amount || order.order_notes || ""}
Maturity Date: ${intake.pn_maturity_date || ""}

The Borrower promises to repay the Lender the above amount.

Borrower Signature: ______________________

Lender Signature: ______________________
    `;

    console.log("📄 Document text created");

    // 3️⃣ CONVERT TEXT → HTML
    const html = `
      <html>
        <body style="font-family: Arial; padding:40px; white-space: pre-wrap;">
          ${documentText}
        </body>
      </html>
    `;

    // 4️⃣ GENERATE PDF
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    console.log("✅ PDF generated");

    // 5️⃣ UPLOAD TO SUPABASE STORAGE
    const filePath = `documents/${order_id}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    console.log("📦 Uploaded to storage:", filePath);

    // 6️⃣ SAVE TO DATABASE
    const { error: updateError } = await supabase
      .from("pweb_orders")
      .update({
        generated_document: documentText,
        pdf_path: filePath,
        order_status: "document_created",
      })
      .eq("order_id", order_id);

    if (updateError) {
      console.error("❌ DB update error:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    console.log("✅ Database updated");

    // ✅ FINAL RESPONSE
    return res.status(200).json({
      success: true,
      message: "Fulfillment completed",
      order_id,
      pdf_path: filePath,
    });

  } catch (err) {
    console.error("🔥 FATAL ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
