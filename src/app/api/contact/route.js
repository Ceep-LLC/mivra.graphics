import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = process.env.CONTACT_TO_EMAIL; // あなたの受信先アドレス
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || "MIVRA <onboarding@resend.dev>";

// 簡易メール判定
function isEmail(v = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// HTMLサニタイズ（XSS対策）
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req) {
  try {
    const body = await req.json();

    // ======== スパム対策 ========
    // ハニーポット
    if (body.hp_code) {
      return NextResponse.json({ ok: true }, { status: 200 }); // 何もせず成功風に返す
    }

    // タイムトラップ（あまりに早い送信はスパム扱い）
    const elapsed = Number(body.elapsedSec ?? 0);
    if (Number.isFinite(elapsed) && elapsed < 2) {
      return NextResponse.json({ message: "Invalid submission." }, { status: 400 });
    }

    // ======== 必須項目 ========
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !isEmail(email) || !message) {
      return NextResponse.json({ message: "必須項目が未入力です。" }, { status: 400 });
    }

    // ======== メール送信内容 ========
    const subject = `New inquiry from ${name}`;
    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      "----- Message -----",
      message,
    ].join("\n");

    const html = `
      <div style="font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <h2 style="margin:0 0 12px;">New inquiry from ${escapeHtml(name)}</h2>
        <ul style="padding-left:16px; margin:0 0 16px;">
          <li><strong>Email:</strong> ${escapeHtml(email)}</li>
        </ul>
        <hr style="border:none; border-top:1px solid #eee; margin:16px 0;" />
        <pre style="white-space:pre-wrap; font:inherit;">${escapeHtml(message)}</pre>
      </div>
    `;

    // ======== Resend送信 ========
    if (!process.env.RESEND_API_KEY || !TO_EMAIL) {
      console.warn("⚠️ Resend環境変数が未設定。メール送信はスキップされます。");
    } else {
      const sendRes = await resend.emails.send({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject,
        reply_to: email,
        text,
        html,
      });

      if (sendRes.error) {
        console.error("Resend error:", sendRes.error);
        return NextResponse.json({ message: "メール送信に失敗しました。" }, { status: 500 });
      }
    }

    // ======== 完了 ========
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "サーバーエラーが発生しました。" }, { status: 500 });
  }
}