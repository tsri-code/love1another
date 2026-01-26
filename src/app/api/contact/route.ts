import { NextRequest, NextResponse } from "next/server";

// Rate limiting for contact form
const contactAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // Max 5 submissions per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkContactRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = contactAttempts.get(ip);

  if (!record || now > record.resetAt) {
    contactAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

const SUBJECT_LABELS: Record<string, string> = {
  question: "Question",
  feature: "Feature Request",
  bug: "Bug Report",
  review: "Review/Feedback",
  other: "Other",
};

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || 
               request.headers.get("x-real-ip") || 
               "unknown";

    if (!checkContactRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Validate subject
    if (!SUBJECT_LABELS[subject]) {
      return NextResponse.json(
        { error: "Invalid subject" },
        { status: 400 }
      );
    }

    // Check for Brevo API key
    const brevoApiKey = process.env.BREVO_API_KEY;
    
    if (!brevoApiKey) {
      // Log the contact submission if no email service configured
      console.log("Contact form submission (no email service configured):", {
        name,
        email,
        subject: SUBJECT_LABELS[subject],
        message,
        timestamp: new Date().toISOString(),
      });
      
      // For development/testing, still return success
      return NextResponse.json({ success: true });
    }

    // Send email via Brevo (Sendinblue)
    const subjectLine = `[Love1Another] ${SUBJECT_LABELS[subject]}: New message from ${name}`;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Form Submission</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="padding: 32px 24px; background-color: #5c7c5c; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
          Love1Another
        </h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
          Contact Form Submission
        </p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px 24px;">
        <!-- Subject Badge -->
        <div style="margin-bottom: 24px;">
          <span style="display: inline-block; padding: 6px 12px; background-color: #f0f4f0; color: #5c7c5c; border-radius: 16px; font-size: 14px; font-weight: 500;">
            ${SUBJECT_LABELS[subject]}
          </span>
        </div>

        <!-- Sender Info -->
        <div style="margin-bottom: 24px; padding: 16px; background-color: #fafafa; border-radius: 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding-bottom: 8px;">
                <strong style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">From</strong>
              </td>
            </tr>
            <tr>
              <td>
                <p style="margin: 0; font-size: 16px; color: #333; font-weight: 500;">${name}</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #666;">
                  <a href="mailto:${email}" style="color: #5c7c5c; text-decoration: none;">${email}</a>
                </p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Message -->
        <div style="margin-bottom: 24px;">
          <strong style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Message</strong>
          <div style="padding: 16px; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
            <p style="margin: 0; font-size: 15px; color: #333; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
        </div>

        <!-- Reply Button -->
        <div style="text-align: center; margin-top: 32px;">
          <a href="mailto:${email}?subject=Re: ${SUBJECT_LABELS[subject]}" 
             style="display: inline-block; padding: 12px 32px; background-color: #5c7c5c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
            Reply to ${name}
          </a>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px; background-color: #fafafa; text-align: center; border-top: 1px solid #e5e5e5;">
        <p style="margin: 0; color: #999; font-size: 12px;">
          This message was sent from the Love1Another contact form.
        </p>
        <p style="margin: 8px 0 0; color: #999; font-size: 12px;">
          Submitted on ${new Date().toLocaleString("en-US", { 
            weekday: "long", 
            year: "numeric", 
            month: "long", 
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short"
          })}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    // Brevo API (formerly Sendinblue)
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify({
        sender: {
          name: "Love1Another",
          email: "support@love1another.app",
        },
        to: [
          {
            email: "support@love1another.app",
            name: "Love1Another Support",
          },
        ],
        replyTo: {
          email: email,
          name: name,
        },
        subject: subjectLine,
        htmlContent: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API error:", errorData);
      throw new Error("Failed to send email");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}
