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
app.use(express.static(path.join(__dirname, 'public')));

// Create directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const productsDir = path.join(__dirname, 'products');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir);
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

const upload = multer({ storage: storage });

// Load products from file
function loadProducts() {
  try {
    const data = fs.readFileSync(path.join(productsDir, 'products.json'), 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
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
app.post('/api/products', upload.array('media', 5), (req, res) => {
  try {
    const { name, price, category, sizes, description } = req.body;
    
    // Process sizes
    const sizesArray = sizes ? sizes.split(',').map(s => s.trim()) : ["S", "M", "L"];
    
    // Process media files
    const mediaFiles = req.files.map(file => {
      const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
      return {
        type: fileType,
        url: `/uploads/${file.filename}`
      };
    });
    
    // Create new product
    const newProduct = {
      id: Date.now(),
      name,
      price: parseFloat(price),
      category,
      image: mediaFiles.length > 0 ? mediaFiles[0].url : '',
      media: mediaFiles,
      sizes: sizesArray,
      description,
      reviews: []
    };
    
    // Save product
    const products = loadProducts();
    products.push(newProduct);
    saveProducts(products);
    
    res.status(201).json({ message: 'Product added successfully', product: newProduct });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ message: 'Failed to add product' });
  }
});

// Update product
app.put('/api/products/:id', upload.array('media', 5), (req, res) => {
  try {
    const { name, price, category, sizes, description } = req.body;
    const productId = parseInt(req.params.id);
    
    // Process sizes
    const sizesArray = sizes ? sizes.split(',').map(s => s.trim()) : ["S", "M", "L"];
    
    let products = loadProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Process media files
    const mediaFiles = req.files.map(file => {
      const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
      return {
        type: fileType,
        url: `/uploads/${file.filename}`
      };
    });
    
    // Update product
    products[productIndex] = {
      ...products[productIndex],
      name,
      price: parseFloat(price),
      category,
      sizes: sizesArray,
      description,
      // Update media if new files were uploaded
      ...(mediaFiles.length > 0 && {
        image: mediaFiles[0].url,
        media: mediaFiles
      })
    };
    
    saveProducts(products);
    res.json({ message: 'Product updated successfully', product: products[productIndex] });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Failed to update product' });
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
    products.splice(productIndex, 1);
    saveProducts(products);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
