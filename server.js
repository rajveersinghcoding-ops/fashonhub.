const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('.')); // Serve static files from current directory

// Create directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const productsDir = path.join(__dirname, 'products');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Load products from file
function loadProducts() {
  try {
    const data = fs.readFileSync(path.join(productsDir, 'products.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Return sample products if file doesn't exist
    return [
      {
        id: 1,
        name: "Classic White T-Shirt",
        price: 19.99,
        category: "men",
        image: "/uploads/sample-tshirt.jpg",
        media: [
          { type: 'image', url: "/uploads/sample-tshirt.jpg" }
        ],
        description: "A classic white t-shirt made from 100% cotton. Perfect for casual wear.",
        sizes: ["S", "M", "L", "XL"],
        reviews: [
          {
            name: "John Doe",
            date: "2025-05-15",
            rating: 5,
            comment: "Great quality t-shirt, fits perfectly!"
          }
        ]
      },
      {
        id: 2,
        name: "Denim Jacket",
        price: 49.99,
        category: "women",
        image: "/uploads/sample-jacket.jpg",
        media: [
          { type: 'image', url: "/uploads/sample-jacket.jpg" }
        ],
        description: "Stylish denim jacket with a modern fit. Perfect for layering.",
        sizes: ["XS", "S", "M", "L"],
        reviews: [
          {
            name: "Emily Johnson",
            date: "2025-05-12",
            rating: 5,
            comment: "Love this jacket! It's my new favorite."
          }
        ]
      }
    ];
  }
}

// Save products to file
function saveProducts(products) {
  fs.writeFileSync(path.join(productsDir, 'products.json'), JSON.stringify(products, null, 2));
}

// API Routes

// Get all products
app.get('/api/products', (req, res) => {
  const products = loadProducts();
  res.json(products);
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
  const products = loadProducts();
  const product = products.find(p => p.id == req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json(product);
});

// Add new product with image upload
app.post('/api/products', upload.array('media', 10), (req, res) => {
  try {
    const { name, price, category, sizes, description } = req.body;
    
    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }
    
    // Process sizes
    const sizesArray = sizes ? sizes.split(',').map(s => s.trim()) : ["S", "M", "L"];
    
    // Process media files
    const mediaFiles = req.files.map(file => {
      const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
      return {
        type: fileType,
        url: `/uploads/${file.filename}`,
        filename: file.filename
      };
    });
    
    // Create new product
    const newProduct = {
      id: Date.now(),
      name,
      price: parseFloat(price),
      category,
      image: mediaFiles.length > 0 ? mediaFiles[0].url : '/uploads/default-product.jpg',
      media: mediaFiles,
      sizes: sizesArray,
      description: description || '',
      reviews: []
    };
    
    // Save product
    const products = loadProducts();
    products.push(newProduct);
    saveProducts(products);
    
    res.status(201).json({ message: 'Product added successfully', product: newProduct });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ message: 'Failed to add product', error: err.message });
  }
});

// Update product
app.put('/api/products/:id', upload.array('media', 10), (req, res) => {
  try {
    const { name, price, category, sizes, description } = req.body;
    const productId = parseInt(req.params.id);
    
    let products = loadProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Process sizes
    const sizesArray = sizes ? sizes.split(',').map(s => s.trim()) : ["S", "M", "L"];
    
    // Update product data
    const updatedProduct = {
      ...products[productIndex],
      name: name || products[productIndex].name,
      price: price ? parseFloat(price) : products[productIndex].price,
      category: category || products[productIndex].category,
      sizes: sizesArray,
      description: description || products[productIndex].description
    };
    
    // Process new media files if uploaded
    if (req.files && req.files.length > 0) {
      const mediaFiles = req.files.map(file => {
        const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
        return {
          type: fileType,
          url: `/uploads/${file.filename}`,
          filename: file.filename
        };
      });
      
      updatedProduct.media = mediaFiles;
      updatedProduct.image = mediaFiles[0].url;
    }
    
    // Update product in array
    products[productIndex] = updatedProduct;
    saveProducts(products);
    
    res.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Failed to update product', error: err.message });
  }
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    let products = loadProducts();
    
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Remove product
    const deletedProduct = products.splice(productIndex, 1)[0];
    saveProducts(products);
    
    res.json({ message: 'Product deleted successfully', product: deletedProduct });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
});

// Get orders
app.get('/api/orders', (req, res) => {
  try {
    const ordersData = fs.existsSync(path.join(__dirname, 'orders.json')) 
      ? JSON.parse(fs.readFileSync(path.join(__dirname, 'orders.json'), 'utf8'))
      : [];
    res.json(ordersData);
  } catch (err) {
    res.json([]);
  }
});

// Save order
app.post('/api/orders', (req, res) => {
  try {
    const order = req.body;
    const orders = fs.existsSync(path.join(__dirname, 'orders.json')) 
      ? JSON.parse(fs.readFileSync(path.join(__dirname, 'orders.json'), 'utf8'))
      : [];
    
    order.id = 'ORD-' + Date.now();
    order.date = new Date().toISOString();
    orders.push(order);
    
    fs.writeFileSync(path.join(__dirname, 'orders.json'), JSON.stringify(orders, null, 2));
    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save order', error: err.message });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Serve the HTML file for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`FashionHub Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(`Products directory: ${productsDir}`);
});
