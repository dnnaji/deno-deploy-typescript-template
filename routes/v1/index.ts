import { Hono } from '@hono/hono';
import alertRouter from '@/routes/v1/alert-routes.ts'; // Use alias for consistency

const v1Router = new Hono();

// Register sub-routers
v1Router.route('/', alertRouter);

// Add other v1 routes here
// v1Router.route('/users', userRouter);

export default v1Router;
