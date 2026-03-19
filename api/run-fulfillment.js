import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    console.log("🚀 Run Fulfillment Triggered");

    // ==============================
    // ✅ ACCEPT BOTH GET + POST
    // ==============================
    let order_id = null;

    if (req.method === "POST") {
      order_id = req.body?.order_id;
    } else if (req.method === "GET") {
      order_id = req.query?.order_id;
    }

    if (!order_id) {
      return res.status(400).json({
        error: "Missing order_id",
        hint: "Use ?order_id=XXXX or send in POST body"
      });
    }

    console.log("📦 Order ID:", order_id);

    // ==============================
    // ✅ FORCE CORRECT SUPABASE
    // ==============================
    const supabase = createClient(
      "https://vvjbjfltqsivvxxifnvi.supabase.co",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ==============================
    // ✅ FETCH ORDER
    // ==============================
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

    const intake = order.intake_json || {};

    // ==============================
    // 🧾 GENERATE DOCUMENT (V1 TEXT)
    // ==============================
    const documentText = `
PROMISSORY NOTE

Lender: ${intake.pn_lender_name || "N/A"}
Borrower: ${intake.pn_borrower_name || "N/A"}

Principal Amount: $${intake.pn_principal_amount || "0"}
Interest Rate: ${intake.pn_interest_rate || "0"}%

Maturity Date: ${intake.pn_maturity_date || "N/A"}

Address: ${intake.street_address || ""}
City: ${intake.city || ""}
State: ${intake.state || ""}
Zip: ${intake.zip || ""}

This agreement is legally binding.
`;

    console.log("📄 Document Generated");

    // ==============================
    // 💾 SAVE DOCUMENT
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
