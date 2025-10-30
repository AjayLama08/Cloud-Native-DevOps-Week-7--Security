import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && value === date.toISOString();
}

type ProductUpdatedDto = {
  id: string;
  name: string;
  pricePence: number;
  description: string;
  updatedAt: string; // ISO string format
};

function parsePayload(
  body: any,
):
  | { success: true; data: ProductUpdatedDto }
  | { success: false; issues: string[] } {
  const issues: string[] = [];
  if (!body || typeof body !== 'object') {
    return { success: false, issues: ['Body must be a JSON object.'] };
  }

  const { id, name, pricePence, description, updatedAt } =
    body as Partial<ProductUpdatedDto>;

  if (typeof id !== 'string' || id.trim().length === 0)
    issues.push('id must be a non-empty string');
  if (typeof name !== 'string' || name.trim().length === 0)
    issues.push('name must be a non-empty string');
  if (
    typeof pricePence !== 'number' ||
    !Number.isInteger(pricePence) ||
    pricePence < 0
  )
    issues.push('pricePence must be a non-negative integer');
  if (typeof description !== 'string')
    issues.push('description must be a string');
  if (!isIsoDateString(updatedAt))
    issues.push('updatedAt must be an ISO 8601 string (Date.toISOString)');

  if (issues.length > 0) {
    return { success: false, issues: issues };
  }

  return {
    success: true,
    data: { id, name, pricePence, description, updatedAt } as ProductUpdatedDto,
  };
}

async function productUpdatedHttpHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log('Received product-updated event');
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    context.warn('Invalid JSON body', err);
    return {
      status: 400,
      jsonBody: { error: 'Invalid JSON body' },
    };
  }

  const result = parsePayload(body);
  if (!result.success) {
    const issues = (result as { success: false; issues: string[] }).issues;
    context.warn('Validation failed', issues);
    return {
      status: 400,
      jsonBody: { error: 'ValidationError', details: issues },
    };
  }

  // This service is a sink (dev-null). Log and acknowledge.
  context.log('Product updated:', result.data);

  return {
    status: 202,
    jsonBody: { message: 'accepted' },
  };
}

app.http('product-updated-http', {
  route: 'product-updated',
  methods: ['POST'],
  authLevel: 'function',
  handler: productUpdatedHttpHandler,
});
