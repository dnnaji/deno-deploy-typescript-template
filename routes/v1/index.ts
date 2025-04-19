import { Hono } from 'hono'; // Use standard Hono
import alertRouter from './alert-routes.ts';

const v1Router = new Hono();

// Register sub-routers
v1Router.route('/', alertRouter);

// Add other v1 routes here
// v1Router.route('/users', userRouter);

export default v1Router;