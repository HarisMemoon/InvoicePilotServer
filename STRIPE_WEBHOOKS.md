# Stripe webhook setup

## Local development

Install and authenticate the [Stripe CLI](https://docs.stripe.com/stripe-cli), then run:

```sh
npm run dev
```

The script starts `stripe listen`, forwards `checkout.session.completed` events to the local webhook route, reads the CLI's local signing secret, and starts the backend with that secret. It does not create or update a Stripe Dashboard endpoint and does not require ngrok.

If Stripe CLI reports an expired API key, refresh its own authentication with `stripe login` and restart the command. If the old authentication is still being used, run `stripe logout` first. This is separate from the webhook signing secret and backend `.env` values.

Use Stripe test keys in the local backend environment. `npm run dev:server` starts only the API and does not forward Stripe events.

## Production

Create one Stripe webhook endpoint for the deployed backend and subscribe it to `checkout.session.completed`:

```text
https://invoicepilotserver.onrender.com/api/stripe/webhook
```

Set the endpoint's signing secret as the backend's `STRIPE_WEBHOOK_SECRET` environment variable. Set the matching live `STRIPE_SECRET_KEY` and the deployed frontend origin as `FRONTEND_URL`. These values belong in the backend deployment environment, never in frontend `VITE_` variables.

The production endpoint URL stays fixed. The backend no longer changes Stripe Dashboard webhook settings when it starts.
