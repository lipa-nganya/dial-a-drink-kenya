# Dial A Drink Kenya - Enhanced Version

A modern, full-stack web application for ordering drinks online in Kenya. Built with React, Node.js, Express, and PostgreSQL.

## Features

- 🍹 **Comprehensive Drink Catalog** - Browse drinks by category with search functionality
- 🛒 **Shopping Cart** - Add, remove, and modify items in your cart
- 📱 **Responsive Design** - Works perfectly on mobile and desktop
- 🚚 **Order Management** - Place orders with delivery information
- ⭐ **Popular Items** - Highlighted popular drinks
- 🎨 **Modern UI** - Clean, intuitive interface with Material-UI

## Tech Stack

### Frontend
- React 18
- Material-UI (MUI)
- React Router
- Axios for API calls
- Context API for state management

### Backend
- Node.js
- Express.js
- Sequelize ORM
- PostgreSQL
- CORS enabled

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dial-a-drink
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Configure the database**
   - Create a PostgreSQL database named `dialadrink`
   - Update the database configuration in `backend/config.js`

5. **Start the development servers**

   **Backend (Terminal 1):**
   ```bash
   cd backend
   npm run dev
   ```

   **Frontend (Terminal 2):**
   ```bash
   cd frontend
   npm start
   ```

6. **Seed the database (optional)**
   ```bash
   cd backend
   node seed.js
   ```

## API Endpoints

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID

### Drinks
- `GET /api/drinks` - Get all drinks
- `GET /api/drinks/:id` - Get drink by ID
- Query parameters:
  - `category` - Filter by category ID
  - `search` - Search by name or description
  - `popular` - Filter popular drinks

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order by ID
- `PATCH /api/orders/:id/status` - Update order status

## Deployment

### Render Deployment

1. **Database Setup**
   - Create a PostgreSQL database on Render
   - Note the database URL

2. **Backend Deployment**
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variable: `DATABASE_URL`

3. **Frontend Deployment**
   - Deploy as a static site
   - Set build command: `npm run build`
   - Set publish directory: `build`
   - Add environment variable: `REACT_APP_API_URL` (your backend URL)

## Project Structure

```
dial-a-drink/
├── backend/
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── config.js        # Database configuration
│   ├── app.js          # Express app setup
│   ├── server.js       # Server entry point
│   └── seed.js         # Database seeding
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── contexts/   # React contexts
│   │   └── services/   # API services
│   └── public/
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Contact

For questions or support, please contact the development team.
