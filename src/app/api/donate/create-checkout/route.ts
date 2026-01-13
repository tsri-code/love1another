import { NextResponse } from "next/server";
import Stripe from "stripe";

// Lazy initialization - only create Stripe when actually needed
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    // Check if Stripe is configured
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Donations are not yet configured. Please try again later." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { amount, email } = body;

    // Validate amount (in cents, minimum $1 = 100 cents)
    if (!amount || typeof amount !== "number" || amount < 100) {
      return NextResponse.json(
        { error: "Invalid donation amount" },
        { status: 400 }
      );
    }

    // Get the origin for redirect URLs
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      submit_type: "donate",
      billing_address_collection: "auto",
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Love1Another Donation",
              description: "Thank you for supporting Love1Another!",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/donate`,
      // Customize the payment page appearance
      payment_intent_data: {
        // This ensures the receipt shows "Love1Another"
        statement_descriptor: "LOVE1ANOTHER",
        statement_descriptor_suffix: "DONATION",
        metadata: {
          source: "love1another_donation",
        },
      },
      // Request email receipt
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: "Thank you for your generous donation to Love1Another!",
          footer: "Love1Another - Helping Christians pray for one another.",
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe checkout error:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
