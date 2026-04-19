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
        error: 'order
