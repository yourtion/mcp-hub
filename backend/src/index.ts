import { serve } from '@hono/node-server'
import { app } from './app';
import { initConfig } from './services/config';

initConfig();

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log("Server started on port " + info.port);
  }
);
