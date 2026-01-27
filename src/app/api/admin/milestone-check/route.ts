import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Milestones to notify about
const MILESTONES = [50, 100, 150];

// Your notification email
const NOTIFICATION_EMAIL = "support@love1another.app";

// Brevo API key
const BREVO_API_KEY = process.env.BREVO_API_KEY;

/**
 * Check if user count has reached a milestone and send notification email
 * Called after successful user signup
 */
export async function POST() {
  try {
    // Use service role to count users
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Count total users in auth.users
    const { count, error } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Error counting users:", error);
      return NextResponse.json({ error: "Failed to count users" }, { status: 500 });
    }

    const userCount = count || 0;

    // Check if we hit a milestone
    if (!MILESTONES.includes(userCount)) {
      return NextResponse.json({ 
        message: "No milestone reached", 
        userCount 
      });
    }

    // Check if we already sent notification for this milestone
    // We'll use a simple table to track sent milestones
    const { data: existingMilestone } = await supabase
      .from("milestone_notifications")
      .select("id")
      .eq("milestone", userCount)
      .single();

    if (existingMilestone) {
      return NextResponse.json({ 
        message: "Milestone already notified", 
        userCount 
      });
    }

    // Send email via Brevo
    if (!BREVO_API_KEY) {
      console.error("BREVO_API_KEY not configured");
      return NextResponse.json({ error: "Email not configured" }, { status: 500 });
    }

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Love1Another",
          email: "noreply@love1another.app",
        },
        to: [
          {
            email: NOTIFICATION_EMAIL,
            name: "Love1Another Admin",
          },
        ],
        subject: `🎉 Milestone Reached: ${userCount} Users!`,
        htmlContent: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #c9a227; margin: 0; font-size: 48px;">🎉</h1>
              <h2 style="color: #333; margin: 10px 0 0 0;">Milestone Reached!</h2>
            </div>
            
            <div style="background: linear-gradient(135deg, #c9a227 0%, #b8960f 100%); border-radius: 16px; padding: 30px; text-align: center; color: white; margin-bottom: 30px;">
              <p style="margin: 0 0 10px 0; font-size: 18px; opacity: 0.9;">Love1Another now has</p>
              <p style="margin: 0; font-size: 64px; font-weight: bold;">${userCount}</p>
              <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">registered users!</p>
            </div>
            
            <div style="text-align: center; color: #666;">
              <p>Keep up the great work! Your prayer community is growing.</p>
              <p style="margin-top: 30px; font-size: 14px; color: #999;">
                This is an automated notification from Love1Another.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Brevo email error:", errorData);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    // Record that we sent this milestone notification
    await supabase
      .from("milestone_notifications")
      .insert({ milestone: userCount, sent_at: new Date().toISOString() });

    console.log(`🎉 Milestone notification sent: ${userCount} users!`);

    return NextResponse.json({ 
      message: "Milestone notification sent!", 
      userCount,
      milestone: userCount
    });

  } catch (error) {
    console.error("Milestone check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
