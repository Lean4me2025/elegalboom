import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    console.log("🚀 Run Fulfillment Triggered");

    // ✅ FORCE CORRECT SUPABASE CONNECTION (temporary override)
    const supabase = createClient(
      "https://vvjbjfltqsivvxxifnvi.supabase.co",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ Get order ID from request
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "Missing order_id" });
    }

    console.log("📦 Processing Order:", order_id);

    // ✅ Fetch order from database
    const { data: order, error: fetchError } = await supabase
      .from('pweb_orders')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (fetchError || !order) {
      console.error("❌ Fetch Error:", fetchError);
      return res.status(500).json({ error: "Order not found" });
    }

    console.log("✅ Order Loaded");

    // ✅ Extract intake JSON
    const intake = order.intake_json || {};

    // ==============================
    // 🧾 SIMPLE DOCUMENT GENERATION
    // ==============================

    const documentText = `
PROMISSORY NOTE

Lender: ${intake.pn_lender_name || "N/A"}
Borrower: ${intake.pn_borrower_name || "N/A"}

Principal Amount: $${intake.pn_principal_amount || "0"}
Interest Rate: ${intake.pn_interest_rate || "0"}%

Maturity Date: ${intake.pn_maturity_date || "N/A"}

This agreement is legally binding.
`;

    console.log("📄 Document Generated");

    // ==============================
    // 💾 STORE DOCUMENT (TEMP TEXT)
    // ==============================

    const { error: updateError } = await supabase
      .from('pweb_orders')
      .update({
        generated_document: documentText,
        order_status: "document_created"
      })
      .eq('order_id', order_id);

    if (updateError) {
      console.error("❌ Update Error:", updateError);
      return res.status(500).json({ error: "Failed to save document" });
    }

    console.log("✅ Document Saved");

    // ==============================
    // 🎉 SUCCESS RESPONSE
    // ==============================

    return res.status(200).json({
      success: true,
      message: "Fulfillment completed",
      order_id
    });

  } catch (err) {
    console.error("🔥 FATAL ERROR:", err);
    return res.status(500).json({
      error: "Fulfillment failed",
      details: err.message
    });
  }
}
