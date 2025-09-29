const express = require('express');
const ejs = require('ejs');
const multer = require('multer');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize data files
const initializeDataFiles = () => {
    const files = [
        { name: 'products.json', defaultData: [] },
        { name: 'cart.json', defaultData: [] },
        { name: 'orders.json', defaultData: [] }
    ];

    files.forEach(file => {
        const filePath = path.join(dataDir, file.name);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(file.defaultData, null, 2));
        }
    });
};

initializeDataFiles();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept images and videos
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Helper functions to read and write data
const readData = (filename) => {
    try {
        const filePath = path.join(dataDir, filename);
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

const writeData = (filename, data) => {
    try {
        const filePath = path.join(dataDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
};

// API Routes

// Get all products
app.get('/api/products', (req, res) => {
    const products = readData('products.json');
    res.json(products);
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
    const products = readData('products.json');
    const product = products.find(p => p.id === parseInt(req.params.id));
    
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
});

// Add new product
app.post('/api/products', upload.array('media', 10), (req, res) => {
    try {
        const products = readData('products.json');
        
        // Process sizes input
        let sizes = [];
        if (req.body.sizes) {
            sizes = req.body.sizes.split(',').map(size => size.trim());
        } else {
            sizes = ["S", "M", "L"]; // Default sizes if none provided
        }
        
        // Process media files
        const mediaFiles = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
                mediaFiles.push({
                    type: fileType,
                    url: `/uploads/${file.filename}`,
                    name: file.filename
                });
            });
        }
        
        // Create new product
        const newProduct = {
            id: Date.now(),
            name: req.body.name,
            price: parseFloat(req.body.price),
            category: req.body.category,
            image: mediaFiles.length > 0 ? mediaFiles[0].url : '/img/placeholder.jpg',
            media: mediaFiles,
            sizes: sizes,
            description: req.body.description,
            reviews: []
        };
        
        products.push(newProduct);
        writeData('products.json', products);
        
        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ message: 'Failed to add product' });
    }
});

// Update product
app.put('/api/products/:id', upload.array('media', 10), (req, res) => {
    try {
        const products = readData('products.json');
        const productIndex = products.findIndex(p => p.id === parseInt(req.params.id));
        
        if (productIndex === -1) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        // Process sizes input
        let sizes = [];
        if (req.body.sizes) {
            sizes = req.body.sizes.split(',').map(size => size.trim());
        } else {
            sizes = products[productIndex].sizes;
        }
        
        // Process media files
        let mediaFiles = products[productIndex].media || [];
        
        // If new media files were uploaded, add them to the existing ones
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
                mediaFiles.push({
                    type: fileType,
                    url: `/uploads/${file.filename}`,
                    name: file.filename
                });
            });
        }
        
        // Update product
        const updatedProduct = {
            ...products[productIndex],
            name: req.body.name || products[productIndex].name,
            price: req.body.price ? parseFloat(req.body.price) : products[productIndex].price,
            category: req.body.category || products[productIndex].category,
            sizes: sizes,
            description: req.body.description || products[productIndex].description,
            image: mediaFiles.length > 0 ? mediaFiles[0].url : products[productIndex].image,
            media: mediaFiles
        };
        
        products[productIndex] = updatedProduct;
        writeData('products.json', products);
        
        res.json({ message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Failed to update product' });
    }
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
    try {
        const products = readData('products.json');
        const productIndex = products.findIndex(p => p.id === parseInt(req.params.id));
        
        if (productIndex === -1) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        // Delete media files from filesystem
        const product = products[productIndex];
        if (product.media && product.media.length > 0) {
            product.media.forEach(media => {
                const filePath = path.join(__dirname, 'public', media.url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }
        
        products.splice(productIndex, 1);
        writeData('products.json', products);
        
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Failed to delete product' });
    }
});

// Cart routes
app.get('/api/cart', (req, res) => {
    const cart = readData('cart.json');
    res.json(cart);
});

app.post('/api/cart', (req, res) => {
    try {
        const cart = readData('cart.json');
        const { productId, size } = req.body;
        
        const existingItem = cart.find(item => item.productId === productId && item.size === size);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            // Get product details
            const products = readData('products.json');
            const product = products.find(p => p.id === productId);
            
            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }
            
            cart.push({
                productId: productId,
                name: product.name,
                price: product.price,
                image: product.image,
                size: size,
                quantity: 1
            });
        }
        
        writeData('cart.json', cart);
        res.json({ message: 'Item added to cart', cart });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Failed to add item to cart' });
    }
});

app.put('/api/cart/:productId/:size', (req, res) => {
    try {
        const cart = readData('cart.json');
        const { productId, size } = req.params;
        const { change } = req.body;
        
        const item = cart.find(item => item.productId === parseInt(productId) && item.size === size);
        
        if (!item) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }
        
        item.quantity += change;
        
        if (item.quantity <= 0) {
            const index = cart.findIndex(i => i.productId === parseInt(productId) && i.size === size);
            cart.splice(index, 1);
        }
        
        writeData('cart.json', cart);
        res.json({ message: 'Cart updated', cart });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ message: 'Failed to update cart' });
    }
});

app.delete('/api/cart/:productId/:size', (req, res) => {
    try {
        const cart = readData('cart.json');
        const { productId, size } = req.params;
        
        const index = cart.findIndex(item => item.productId === parseInt(productId) && item.size === size);
        
        if (index === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }
        
        cart.splice(index, 1);
        writeData('cart.json', cart);
        
        res.json({ message: 'Item removed from cart', cart });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ message: 'Failed to remove item from cart' });
    }
});

// Order routes
app.get('/api/orders', (req, res) => {
    const orders = readData('orders.json');
    res.json(orders);
});

app.post('/api/orders', (req, res) => {
    try {
        const orders = readData('orders.json');
        const cart = readData('cart.json');
        
        if (cart.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }
        
        // Calculate totals
        const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const shipping = subtotal > 0 ? 5.99 : 0;
        const tax = subtotal * 0.08;
        const total = subtotal + shipping + tax;
        
        // Generate order ID
        const orderId = 'ORD-' + Date.now();
        
        // Create order
        const newOrder = {
            id: orderId,
            date: new Date().toISOString(),
            customer: req.body.customer,
            items: [...cart],
            payment: {
                cardName: req.body.payment.cardName,
                cardNumber: req.body.payment.cardNumber.slice(-4), // Only store last 4 digits
                expiry: req.body.payment.expiry
            },
            totals: {
                subtotal: subtotal,
                shipping: shipping,
                tax: tax,
                total: total
            },
            status: 'Processing'
        };
        
        orders.push(newOrder);
        writeData('orders.json', orders);
        
        // Clear cart
        writeData('cart.json', []);
        
        res.status(201).json({ message: 'Order placed successfully', order: newOrder });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ message: 'Failed to place order' });
    }
});

// Self-destruct route
app.post('/api/self-destruct', (req, res) => {
    try {
        // Clear all data
        writeData('products.json', []);
        writeData('cart.json', []);
        writeData('orders.json', []);
        
        // Delete all uploaded files
        const uploadsDir = path.join(__dirname, 'public', 'uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(uploadsDir, file));
            });
        }
        
        res.json({ message: 'All data has been deleted' });
    } catch (error) {
        console.error('Error during self-destruct:', error);
        res.status(500).json({ message: 'Failed to delete all data' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.render('index');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
