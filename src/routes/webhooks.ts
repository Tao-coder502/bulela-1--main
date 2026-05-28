import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Webhook } from 'svix';
import { db } from '../lib/db.js';

interface ClerkWebhookEvent {
  data: {
    id: string;
    first_name: string;
    [key: string]: any;
  };
  type: string;
  [key: string]: any;
}

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/api/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!WEBHOOK_SECRET) {
      throw new Error('Please add CLERK_WEBHOOK_SIGNING_SECRET from Clerk Dashboard to .env');
    }

    // Get the headers
    const svix_id = request.headers['svix-id'] as string;
    const svix_timestamp = request.headers['svix-timestamp'] as string;
    const svix_signature = request.headers['svix-signature'] as string;

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return reply.status(400).send('Error occured -- no svix headers');
    }

    // Get the body
    const payload = request.body;
    const body = JSON.stringify(payload);

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: ClerkWebhookEvent;

    // Verify the payload with the headers
    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return reply.status(400).send('Error occured');
    }

    const { id, first_name } = evt.data;
    const eventType = evt.type;

    if (eventType === 'user.created' || eventType === 'user.updated') {
      try {
        const upsertUser = db.prepare(`
          INSERT INTO users (id, first_name)
          VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name
        `);
        upsertUser.run(id, first_name);
        
        console.log(`Ba Yama is officially ready for ${first_name}!`);
      } catch (dbErr) {
        console.error('Database error during webhook sync:', dbErr);
        return reply.status(500).send('Database error');
      }
    }

    return reply.status(200).send({ success: true });
  });
}
