import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';

export async function healthHttpHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.debug('Health check requested');

  return {
    status: 200,
    jsonBody: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  };
}

app.http('health-http', {
  route: 'health',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: healthHttpHandler,
});
