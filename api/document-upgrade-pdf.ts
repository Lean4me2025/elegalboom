import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

function wrapText(text: string, maxCharsPerLine = 95): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (!trimmed) {
      lines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (candidate.length <= maxCharsPerLine) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    lines.push('');
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines;
}

function buildPdfFileName(orderId: string, htmlPath?: string | null): string {
  const safeOrderId = String(orderId).trim();

  if (htmlPath && htmlPath.toLowerCase().endsWith('.html')) {
    return htmlPath.replace(/\.html$/i, '.pdf');
  }

  return `document-${safeOrderId}.pdf`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const source = req.method === 'GET' ? req.query : (req.body || {});
    const order_id = source.order_id;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: 'order_id is required',
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const bucketName = 'documents';

    const { data: orderRow, error: orderError } = await supabase
      .from('pweb_orders')
      .select('id, order_id, generated_doc_text, docx_path, pdf_path')
      .eq('order_id', order_id)
      .maybeSingle();

    if (orderError || !orderRow) {
      return res.status(404).json({
        success: false,
        error: 'Order not found in pweb_orders',
        details: orderError?.message || null,
        order_id,
      });
    }

    let htmlText = '';
    let sourceMode = 'row.generated_doc_text';
    let sourceHtmlPath: string | null = orderRow.docx_path || null;

    if (orderRow.generated_doc_text && String(orderRow.generated_doc_text).trim()) {
      htmlText = String(orderRow.generated_doc_text);
    } else if (sourceHtmlPath) {
      sourceMode = 'storage.docx_path';

      const { data: htmlBlob, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(sourceHtmlPath);

      if (downloadError || !htmlBlob) {
        return res.status(404).json({
          success: false,
          error: 'Could not obtain HTML source',
          details: downloadError?.message || null,
          bucket: bucketName,
          order_id,
          docx_path: sourceHtmlPath,
          sourceMode,
        });
      }

      htmlText = await htmlBlob.text();
    } else {
      return res.status(400).json({
        success: false,
        error: 'No HTML source found on order row',
        order_id,
      });
    }

    const plainText = htmlToPlainText(htmlText);

    if (!plainText) {
      return res.status(400).json({
        success: false,
        error: 'HTML converted to empty text; no PDF content to generate',
        order_id,
        docx_path: sourceHtmlPath,
        sourceMode,
      });
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const fontSize = 11;
    const lineHeight = 15;
    const maxCharsPerLine = 95;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    page.drawText('e-legalboom.com', {
      x: margin,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    y -= 22;

    page.drawText(`Order ID: ${order_id}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    y -= 16;

    page.drawText(`Source Mode: ${sourceMode}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });

    y -= 14;

    if (sourceHtmlPath) {
      page.drawText(`Source HTML Ref: ${sourceHtmlPath}`, {
        x: margin,
        y,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });

      y -= 24;
    } else {
      y -= 10;
    }

    const lines = wrapText(plainText, maxCharsPerLine);

    for (const line of lines) {
      if (y <= margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const pdfFileName = buildPdfFileName(order_id, sourceHtmlPath);

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(pdfFileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({
        success: false,
        error: 'PDF created but failed to upload to storage',
        details: uploadError.message,
        pdf_path: pdfFileName,
        order_id,
      });
    }

    const { data: updateData, error: updateError } = await supabase
      .from('pweb_orders')
      .update({
        pdf_path: pdfFileName,
      })
      .eq('order_id', order_id)
      .select('id, order_id, pdf_path, docx_path')
      .limit(1);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: 'PDF uploaded, but failed to update pweb_orders.pdf_path',
        details: updateError.message,
        pdf_path: pdfFileName,
        order_id,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'PDF generated, uploaded, and pdf_path updated successfully',
      order_id,
      sourceMode,
      docx_path: sourceHtmlPath,
      pdf_path: pdfFileName,
      updated_row: Array.isArray(updateData) ? updateData[0] ?? null : updateData,
      text_preview: plainText.slice(0, 500),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
    });
  }
}
