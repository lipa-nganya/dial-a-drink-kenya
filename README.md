# 🍹 Dial A Drink Kenya

A modern, mobile-responsive e-commerce platform for beverage delivery in Kenya. Built with React, Node.js, PostgreSQL, and real-time WebSocket notifications.

## ✨ Features

### 🛍️ Customer Features
- **Mobile-First Design**: Fully responsive across all devices
- **Category Browsing**: Browse drinks by categories (Cocktails, Mocktails, etc.)
- **Shopping Cart**: Add/remove items with quantity management
- **Order Placement**: Complete checkout with customer information
- **Real-time Updates**: Live inventory status

### 👨‍💼 Admin Dashboard
- **Real-time Notifications**: Instant alerts with sound when new orders arrive
- **Order Management**: View, update, and track order status
- **Inventory Control**: Toggle drink availability (in stock/out of stock)
- **Dashboard Analytics**: View total orders, pending orders, and inventory stats
- **Mobile Responsive**: Full admin functionality on mobile devices

### 🔧 Technical Features
- **WebSocket Integration**: Real-time communication between frontend and backend
- **RESTful API**: Complete CRUD operations for all entities
- **Database Seeding**: Pre-populated with sample drinks and categories
- **Error Handling**: Comprehensive error management
- **Mobile Optimization**: Touch-friendly interface

## 🚀 Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **Material-UI** - Beautiful, responsive components
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **Socket.io Client** - Real-time WebSocket communication

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Sequelize** - PostgreSQL ORM
- **Socket.io** - Real-time WebSocket server
- **CORS** - Cross-origin resource sharing

### Database
- **PostgreSQL** - Relational database
- **Sequelize Models** - Category, Drink, Order, OrderItem

## 📱 Mobile Responsive Design

The application is fully optimized for mobile devices with:
- **Responsive Grid System**: Adapts to different screen sizes
- **Touch-Friendly Interface**: Optimized for mobile interactions
- **Mobile Navigation**: Hamburger menu for mobile devices
- **Adaptive Typography**: Text scales appropriately
- **Mobile-First Approach**: Designed mobile-first, enhanced for desktop

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- npm or yarn package manager

### Backend Setup
```bash
cd backend
npm install
```

### Frontend Setup
```bash
cd frontend
npm install
```

### Database Setup
1. Create a PostgreSQL database named `dialadrink`
2. Update database credentials in `backend/config.js`
3. Run the backend server to auto-create tables and seed data

### Running the Application

#### Development Mode
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

#### Production Mode
```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run build
```

## 🌐 Application URLs

- **Customer App**: `http://localhost:3000`
- **Admin Dashboard**: `http://localhost:3001`
- **API Health Check**: `http://localhost:5001/api/health`

## 📊 Database Schema

### Categories
- id, name, description, image, isActive

### Drinks
- id, name, description, price, image, categoryId, isAvailable, isPopular

### Orders
- id, customerName, customerPhone, customerEmail, deliveryAddress, totalAmount, status, notes

### Order Items
- id, orderId, drinkId, quantity, price

## 🔌 API Endpoints

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID

### Drinks
- `GET /api/drinks` - Get all drinks
- `GET /api/drinks/:id` - Get drink by ID

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get all orders

### Admin
- `GET /api/admin/orders` - Get all orders for admin
- `GET /api/admin/drinks` - Get all drinks for inventory
- `PATCH /api/admin/drinks/:id/availability` - Update drink availability
- `PATCH /api/admin/orders/:id/status` - Update order status
- `GET /api/admin/stats` - Get dashboard statistics

## 🔔 Real-time Features

### WebSocket Events
- **new-order**: Triggered when a customer places an order
- **join-admin**: Admin joins the admin room for notifications

### Notification System
- **Visual Alerts**: Popup notifications for new orders
- **Sound Alerts**: Audio notifications for admin
- **Real-time Updates**: Live inventory and order status updates

## 📱 Mobile Features

### Responsive Breakpoints
- **xs (0-600px)**: Mobile phones
- **sm (600-960px)**: Tablets  
- **md (960px+)**: Desktop

### Mobile Optimizations
- **Touch Targets**: Properly sized buttons and interactive elements
- **Navigation**: Hamburger menu for mobile
- **Typography**: Responsive font sizes
- **Layout**: Stacked layouts on mobile, side-by-side on desktop

## 🚀 Deployment

### Render.com (Recommended)
1. Connect your GitHub repository to Render
2. Deploy backend as a Web Service
3. Deploy frontend as a Static Site
4. Add PostgreSQL database
5. Update environment variables

### Environment Variables
```env
# Backend
PORT=5001
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=dialadrink
DB_HOST=localhost
DB_PORT=5432

# Frontend
REACT_APP_API_URL=http://localhost:5001/api
```

## 🧪 Testing the Application

### Customer Flow
1. Browse categories and drinks
2. Add items to cart
3. Fill in customer information
4. Place order
5. Receive confirmation

### Admin Flow
1. Open admin dashboard
2. Monitor real-time notifications
3. Update order status
4. Manage inventory (toggle availability)
5. View analytics

## 📈 Future Enhancements

- [ ] User authentication and accounts
- [ ] Payment integration (M-Pesa, Stripe)
- [ ] Order tracking for customers
- [ ] Push notifications
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Inventory management with stock levels
- [ ] Delivery tracking system

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

Built with ❤️ for the Kenyan beverage delivery market.

---

**Ready to revolutionize beverage delivery in Kenya! 🇰🇪🍹**