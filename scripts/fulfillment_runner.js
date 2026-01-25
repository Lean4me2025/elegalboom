/**
 * Fulfillment Runner – v1.0
 * Purpose: Create legal documents for PAID orders and mark them READY
 */

import { createClient } from '@supabase/supabase-js';

// 🔐 Use SERVICE ROLE KEY (never anon)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getOrdersToFulfill() {
  const { data, error } = await supabase
    .from('document_intake')
    .select('*')
    .eq('payment_status', 'paid')
    .eq('fulfillment_status', 'in_progress');

  if (error) throw error;
  return data;
}

async function createDocument(order) {
  console.log(`🛠 Creating document for ${order.order_id}`);

  /**
   * THIS is where your real document logic goes:
   * - Select template based on order.document_type
   * - Merge order fields
   * - Generate DOCX / PDF
   * - Save file(s)
   */

  // Placeholder output paths
  const pdfPath = `/docs/${order.order_id}.pdf`;
  const docxPath = `/docs/${order.order_id}.docx`;

  // Simulate generation
  console.log(`📄 Generated PDF: ${pdfPath}`);
  console.log(`📄 Generated DOCX: ${docxPath}`);

  return {
    pdf_path: pdfPath,
    docx_path: docxPath
  };
}

async function markReady(orderId, paths) {
  const { error } = await supabase
    .from('document_intake')
    .update({
      fulfillment_status: 'ready',
      pdf_path: paths.pdf_path,
      docx_path: paths.docx_path
    })
    .eq('order_id', orderId);

  if (error) throw error;

  console.log(`✅ Order ${orderId} marked READY`);
}

async function runFulfillment() {
  console.log('🔍 Checking for orders to fulfill…');

  const orders = await getOrdersToFulfill();

  if (orders.length === 0) {
    console.log('🟢 No orders ready for fulfillment');
    return;
  }

  for (const order of orders) {
    try {
      const paths = await createDocument(order);
      await markReady(order.order_id, paths);
    } catch (err) {
      console.error(`❌ Failed for ${order.order_id}`, err);
    }
  }

  console.log('🏁 Fulfillment run complete');
}

// ▶ Run it
runFulfillment().catch(console.error);
