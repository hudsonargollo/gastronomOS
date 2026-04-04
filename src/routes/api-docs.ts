/**
 * API Documentation Routes
 * OpenAPI/Swagger documentation for all API endpoints
 * 
 * Requirements: 8.1, 8.2, 19.2
 */

import { Hono } from 'hono';

const app = new Hono();

// OpenAPI 3.0 specification
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'GastronomOS Digital Menu & Kitchen Orchestration API',
    version: '1.0.0',
    description: 'Multi-tenant restaurant management platform with QR menus, kitchen displays, payment processing, and commission tracking',
    contact: {
      name: 'GastronomOS Support',
      email: 'support@gastronomos.com'
    }
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /auth/login endpoint'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          errorCode: { type: 'string' }
        }
      },
      MenuItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'integer', description: 'Price in cents' },
          categoryId: { type: 'string', format: 'uuid' },
          isAvailable: { type: 'boolean' },
          preparationTime: { type: 'integer', description: 'Time in minutes' },
          imageUrl: { type: 'string', format: 'uri' },
          allergens: { type: 'array', items: { type: 'string' } },
          active: { type: 'boolean' },
          createdAt: { type: 'integer' },
          updatedAt: { type: 'integer' }
        }
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string' },
          state: { 
            type: 'string', 
            enum: ['PLACED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'] 
          },
          tableNumber: { type: 'string' },
          waiterId: { type: 'string', format: 'uuid' },
          locationId: { type: 'string', format: 'uuid' },
          totalAmount: { type: 'integer', description: 'Total in cents' },
          specialInstructions: { type: 'string' },
          version: { type: 'integer' },
          createdAt: { type: 'integer' },
          updatedAt: { type: 'integer' }
        }
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          method: { 
            type: 'string', 
            enum: ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'MANUAL_CARD', 'CASH'] 
          },
          amount: { type: 'integer', description: 'Amount in cents' },
          status: { 
            type: 'string', 
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] 
          },
          gatewayTransactionId: { type: 'string' },
          processedBy: { type: 'string', format: 'uuid' },
          createdAt: { type: 'integer' },
          processedAt: { type: 'integer' }
        }
      },
      Commission: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          waiterId: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          orderAmount: { type: 'integer', description: 'Amount in cents' },
          commissionRate: { type: 'number' },
          commissionAmount: { type: 'integer', description: 'Amount in cents' },
          commissionType: { type: 'string', enum: ['PERCENTAGE', 'FIXED_VALUE'] },
          calculatedAt: { type: 'integer' },
          paidAt: { type: 'integer' }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user and receive JWT token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { type: 'object' }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/menu': {
      get: {
        tags: ['Menu Management'],
        summary: 'Get all menu items',
        description: 'Retrieve menu items with optional filtering',
        parameters: [
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'available',
            in: 'query',
            schema: { type: 'boolean' }
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 }
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'Menu items retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/MenuItem' }
                    },
                    pagination: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Menu Management'],
        summary: 'Create menu item',
        description: 'Create a new menu item with optional recipe',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'integer' },
                  categoryId: { type: 'string', format: 'uuid' },
                  preparationTime: { type: 'integer' },
                  imageUrl: { type: 'string', format: 'uri' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Menu item created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    item: { $ref: '#/components/schemas/MenuItem' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/orders': {
      get: {
        tags: ['Order Management'],
        summary: 'Get orders',
        description: 'Retrieve orders with filtering by state, location, waiter',
        parameters: [
          {
            name: 'locationId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'waiterId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'state',
            in: 'query',
            schema: { 
              type: 'string',
              enum: ['PLACED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']
            }
          }
        ],
        responses: {
          '200': {
            description: 'Orders retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    orders: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Order' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Order Management'],
        summary: 'Create order',
        description: 'Create a new order with items',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['locationId', 'items'],
                properties: {
                  locationId: { type: 'string', format: 'uuid' },
                  tableNumber: { type: 'string' },
                  waiterId: { type: 'string', format: 'uuid' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        menuItemId: { type: 'string', format: 'uuid' },
                        quantity: { type: 'integer' },
                        specialInstructions: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Order created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    order: { $ref: '#/components/schemas/Order' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/orders/{orderId}/transition': {
      post: {
        tags: ['Order Management'],
        summary: 'Transition order state',
        description: 'Move order to next state in workflow',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['toState'],
                properties: {
                  toState: { 
                    type: 'string',
                    enum: ['PLACED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']
                  },
                  reason: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'State transition successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    order: { $ref: '#/components/schemas/Order' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/payments/process': {
      post: {
        tags: ['Payment Processing'],
        summary: 'Process payment',
        description: 'Process payment via Mercado Pago (Pix, credit, debit)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId', 'amount', 'method', 'customerEmail'],
                properties: {
                  orderId: { type: 'string', format: 'uuid' },
                  amount: { type: 'integer' },
                  method: { 
                    type: 'string',
                    enum: ['PIX', 'CREDIT_CARD', 'DEBIT_CARD']
                  },
                  customerEmail: { type: 'string', format: 'email' },
                  cardToken: { type: 'string' },
                  installments: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Payment processed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    payment: { $ref: '#/components/schemas/Payment' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/payments/pix/generate': {
      post: {
        tags: ['Payment Processing'],
        summary: 'Generate Pix QR code',
        description: 'Generate Pix QR code with 15-minute expiration',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId', 'amount', 'customerEmail'],
                properties: {
                  orderId: { type: 'string', format: 'uuid' },
                  amount: { type: 'integer' },
                  description: { type: 'string' },
                  customerEmail: { type: 'string', format: 'email' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Pix QR code generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    pix: {
                      type: 'object',
                      properties: {
                        paymentId: { type: 'string' },
                        qrCode: { type: 'string' },
                        qrCodeBase64: { type: 'string' },
                        expirationDate: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/payments/manual': {
      post: {
        tags: ['Payment Processing'],
        summary: 'Log manual payment',
        description: 'Log payment made through external card machine',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId', 'method', 'amount', 'referenceNumber', 'processedBy'],
                properties: {
                  orderId: { type: 'string', format: 'uuid' },
                  method: { 
                    type: 'string',
                    enum: ['MANUAL_CARD', 'CASH']
                  },
                  amount: { type: 'integer' },
                  referenceNumber: { type: 'string' },
                  processedBy: { type: 'string', format: 'uuid' },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Manual payment logged',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    payment: { $ref: '#/components/schemas/Payment' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/commission-reports': {
      get: {
        tags: ['Commission Reporting'],
        summary: 'Get commission reports',
        description: 'Retrieve commission reports by waiter and time period',
        parameters: [
          {
            name: 'waiterId',
            in: 'query',
            schema: { type: 'string', format: 'uuid' }
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'integer' }
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Commission reports retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    reports: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Commission' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/kitchen/orders': {
      get: {
        tags: ['Kitchen Display'],
        summary: 'Get kitchen orders',
        description: 'Retrieve orders for kitchen display (PLACED and PREPARING states)',
        responses: {
          '200': {
            description: 'Kitchen orders retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    orders: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Order' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and JWT token management'
    },
    {
      name: 'Menu Management',
      description: 'Menu item CRUD operations and availability management'
    },
    {
      name: 'Order Management',
      description: 'Order creation, state transitions, and tracking'
    },
    {
      name: 'Payment Processing',
      description: 'Payment processing via Mercado Pago and manual logging'
    },
    {
      name: 'Commission Reporting',
      description: 'Waiter commission tracking and reporting'
    },
    {
      name: 'Kitchen Display',
      description: 'Kitchen order management and preparation tracking'
    }
  ]
};

// Serve OpenAPI JSON spec
app.get('/openapi.json', (c) => {
  return c.json(openApiSpec);
});

// Serve Swagger UI HTML
app.get('/', (c) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GastronomOS API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
  `;
  
  return c.html(html);
});

export default app;
