/**
 * API Trigger for Fulfillment Runner
 * Generates PDFs from pweb_orders
 */

import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { ndaStandardMap } from '../lib/pdf/templates/nda-standard-map.js'

// -----------------------------
// INIT SUPABASE
// -----------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// -----------------------------
// MAP ORDER DATA → TEMPLATE
// -----------------------------
function mapOrderToTemplate(order) {
  return {
    effective_date: new Date(order.created_at).toLocaleDateString(),

    disclosing_party_name: order.party1_name || '',
    disclosing_party_state: order.client_state || '',

    receiving_party_name: order.party2_name || '',
    receiving_party_state: order.client_state || '',

    purpose: order.details || '',

    confidentiality_term_years: '3',

    governing_state: order.governing_state || '',

    disclosing_sign_name: order.party1_name || '',
    disclosing_sign_title: order.party1_role || '',

    receiving_sign_name: order.party2_name || '',
    receiving_sign_title: order.party2_role || ''
  }
}

// -----------------------------
// DRAW TEXT HELPER
// -----------------------------
function drawField(page, font, text, config) {
  if (!text) return

  page.drawText(String(text), {
    x: config.x,
    y: config.y,
    size: config.size || 11,
    font,
    color: rgb(0, 0, 0),
    maxWidth: config.maxWidth || 200
  })
}

// -----------------------------
// CREATE DOCUMENT
// -----------------------------
async function createDocument(order) {
  // ✅ FIXED (string instead of undefined variable)
  if (order.doc_type !== 'nda') return null

  const data = mapOrderToTemplate(order)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([
    ndaStandardMap.page.width,
    ndaStandardMap.page.height
  ])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Title
  page.drawText(ndaStandardMap.static.title.text, {
    x: ndaStandardMap.static.title.x,
    y: ndaStandardMap.static.title.y,
    size: ndaStandardMap.static.title.size,
    font: boldFont
  })

  // Fields
  for (const key in ndaStandardMap.fields) {
    const config = ndaStandardMap.fields[key]
    const value = data[key]
    drawField(page, font, value, config)
  }

  const pdfBytes = await pdfDoc.save()
  const fileName = `${order.order_id}.pdf`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) {
    console.error('UPLOAD ERROR:', uploadError)
    throw uploadError
  }

  // ✅ FIXED (proper template string)
  return `documents/${fileName}`
}

// -----------------------------
// MAIN HANDLER
// -----------------------------
export default async function handler(req, res) {
  try {
    console.log('🚀 Fulfillment started')

    const { data: orders, error } = await supabase
      .from('pweb_orders')
      .select('*')
      .eq('payment_status', 'paid')
      .eq('order_status', 'intake_complete')

    if (error) {
      console.error('DB ERROR:', error)
      return res.status(500).json({ error: error.message })
    }

    if (!orders || orders.length === 0) {
      return res.status(200).json({ message: 'No orders found' })
    }

    for (const order of orders) {
      console.log('Processing order:', order.order_id)

      const pdfPath = await createDocument(order)

      if (pdfPath) {
        await supabase
          .from('pweb_orders')
          .update({
            order_status: 'document_created',
            document_path: pdfPath
          })
          .eq('order_id', order.order_id)
      }
    }

    return res.status(200).json({
      message: 'Fulfillment complete 🚀'
    })

  } catch (err) {
    console.error('FATAL ERROR:', err)
    return res.status(500).json({
      error: err.message
    })
  }
}
