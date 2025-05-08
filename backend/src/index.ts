import { serve } from '@hono/node-server'
import { app } from './app';

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log("Server started on port " + info.port);
  }
);
