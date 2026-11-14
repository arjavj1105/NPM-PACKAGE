'use strict';

const express = require('express');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Built-in middleware
app.use(express.json());

// API Info endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Express Response Cache Demo API',
    version: '1.0.0',
    endpoints: [
      {
        path: '/products',
        method: 'GET',
        description: 'Get all products (cached for 30s). Supports ?category= and ?inStock=',
      },
      {
        path: '/products/:id',
        method: 'GET',
        description: 'Get product by ID (cached for 60s)',
      },
    ],
    headers: {
      'X-Cache': 'Indicates HIT or MISS',
      'X-Cache-Timestamp': 'Timestamp when cached entry was created',
    },
  });
});

// Mount demonstration routes
app.use('/products', productRoutes);

// Global 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[Demo Server Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start listener only when executed directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Demo server listening on http://localhost:${PORT}`);
    console.log('Try testing caching with curl:');
    console.log(`  curl -i http://localhost:${PORT}/products`);
    console.log(`  curl -i http://localhost:${PORT}/products/1`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    server.close(() => {
      console.log('Demo server terminated.');
      process.exit(0);
    });
  });
}

module.exports = app;
