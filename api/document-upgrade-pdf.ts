import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const source = req.method === 'GET' ? req.query : (req.body || {});
    const order_id = source.order_id;
    const html_path = source.html_path;

    if (!order_id || !html_path) {
      return res.status(400).json({
        success: false,
        error: 'order_id and html_path are required',
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

    const { data: rootList, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 100 });

    const rootNames = (rootList || []).map(item => item.name);
    const exactMatch = rootNames.includes(html_path);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(html_path);

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Could not download HTML from storage',
        details: error?.message || null,
        bucket: bucketName,
        html_path,
        exact_match_in_root_list: exactMatch,
        root_list_error: listError?.message || null,
        root_names_sample: rootNames.slice(0, 25),
      });
    }

    const htmlText = await data.text();

    return res.status(200).json({
      success: true,
      message: 'HTML file fetched successfully',
      order_id,
      bucket: bucketName,
      html_path,
      exact_match_in_root_list: exactMatch,
      html_length: htmlText.length,
      html_preview: htmlText.slice(0, 500),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
