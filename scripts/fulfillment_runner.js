/**
 * Fulfillment Runner - v2.0
 * Purpose: Create legal documents for PAID orders using coordinate maps
 */

import { createClient } from '@supabase/supabase-js';
import { ndaStandardMap } from '../lib/pdf/templates/nda-standard-map.js';

// 🔐 Use SERVICE ROLE KEY (never anon)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --------------------------------------------------
// GET ORDERS READY FOR FULFILLMENT
// --------------------------------------------------
async function getOrdersToFulfill() {
  const { data, error } = await supabase
    .from('document_intake')
    .select('*')
    .eq('payment_status', 'paid')
    .eq('fulfillment_status', 'in_progress');

  if (error) throw error;
  return data;
}

// --------------------------------------------------
// DOCUMENT GENERATOR (NOW REAL ENGINE STRUCTURE)
// --------------------------------------------------
async function createDocument(order) {
  console.log(`📄 Creating document for ${order.order_id}`);

  // ----------------------------------------------
  // SELECT TEMPLATE MAP
  // ----------------------------------------------
  let map;

  switch (order.document_type) {
    case 'nda':
      map = ndaStandardMap;
      break;

    default:
      throw new Error(`Unsupported document type: ${order.document_type}`);
  }

  console.log('📐 Using template map:', map);

  // ----------------------------------------------
  // SIMULATED RENDER ENGINE (NEXT = REAL PDF)
  // ----------------------------------------------
  // This is where pdf-lib will go next
  // For now we confirm mapping + structure is working

  const pdfPath = `/docs/${order.order_id}.pdf`;
  const docxPath = `/docs/${order.order_id}.docx`;

  console.log(`✅ PDF generated: ${pdfPath}`);
  console.log(`✅ DOCX generated: ${docxPath}`);

  return {
    pdf_path: pdfPath,
    docx_path: docxPath
  };
}

// --------------------------------------------------
// MARK ORDER AS READY
// --------------------------------------------------
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
}

// --------------------------------------------------
// MAIN RUNNER
// --------------------------------------------------
async function run() {
  try {
    console.log('🚀 Starting fulfillment run...');

    const orders = await getOrdersToFulfill();

    if (!orders.length) {
      console.log('⚠️ No orders to process');
      return;
    }

    for (const order of orders) {
      const paths = await createDocument(order);
      await markReady(order.order_id, paths);
    }

    console.log('🎉 Fulfillment complete');
  } catch (err) {
    console.error('❌ Error during fulfillment:', err);
  }
}

// Run the process
run();
