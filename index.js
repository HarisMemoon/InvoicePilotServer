// index.js
import app from "./src/app.js";
import pkg from "@ngrok/ngrok";
import Stripe from "stripe";
const { connect } = pkg;
const PORT = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_ID = "we_1SHgNRFOUVZDZN55vvdHrMmb";
const server = app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  if (process.env.NODE_ENV !== "production") {
    try {
      const tunnel = await connect({
        addr: PORT,
        authtoken: process.env.NGROK_AUTHTOKEN,
        domain: process.env.NGROK_DOMAIN,
        retries: 3,
        retryDelay: 2000,
      });

      const webhookUrl = `${tunnel.url()}/api/stripe/webhook`;

      // 1. Find existing webhook by ID
      const list = await stripe.webhookEndpoints.list();

      const existing = list.data.find((w) => w.id === WEBHOOK_ID);

      if (existing) {
        // 2. UPDATE existing webhook
        await stripe.webhookEndpoints.update(existing.id, {
          url: webhookUrl,
        });
      } else {
        // 3. CREATE if not found
        //     await stripe.webhookEndpoints.create({
        //       url: webhookUrl,
        //       enabled_events: ["checkout.session.completed"],
        //       description: WEBHOOK_DESCRIPTION,
        //     });
        //     console.log("Stripe webhook CREATED →", webhookUrl);
        //   }
        // 4. (Optional) Delete ALL other ngrok webhooks
        //   const oldHooks = list.data.filter(
        //     (w) => w.url.includes("ngrok") && w.description !== WEBHOOK_DESCRIPTION
        //   );
        //   for (const hook of oldHooks) {
        //     await stripe.webhookEndpoints.del(hook.id);
        //     console.log("Deleted old webhook:", hook.url);
        console.log("Didn't work");
      }
    } catch (err) {
      console.error("ngrok failed:", err.message);
    }
  }
});
