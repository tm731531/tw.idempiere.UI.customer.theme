# iDempiere Resource UI - Docker Development Setup

A Vue.js application for managing iDempiere resources with Docker development environment.

## Quick Start

### Docker Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/iDempiere-Resource-UI.git
   cd iDempiere-Resource-UI
   ```

2. **Start the development environment**
   ```bash
   docker-compose up
   ```

3. **Access the application**
   - Development server: http://localhost:8888

### Ubuntu Setup (Optional)

If you prefer local development:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies and run
cd ui
npm install
npm run dev -- --host 0.0.0.0 --port 8888
```

## Docker Services

### opencode-web
- **Purpose**: Vue.js development server with hot reload
- **Port**: 8888 (maps to container port 5173)
- **Volume**: Live code reloading with `ui/` directory mounted
- **Environment**: Development mode with hot module replacement

## Features

- **Payment Management**: Complete CRUD with bank account integration
- **Consultation Requests**: Customer relationship tracking
- **Order Processing**: Sales order management
- **Resource Booking**: Calendar-based scheduling
- **User Management**: Role-based access control

## Development

### File Structure
```
├── docker-compose.yml      # Docker orchestration
├── ui/                     # Vue.js application
│   ├── Dockerfile.dev      # Development container
│   ├── src/                # Source code
│   ├── package.json        # Dependencies
│   └── vite.config.ts      # Vite configuration
└── README.md
```

### Docker Commands

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f opencode-web

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build
```

## Configuration

### Environment Variables

Create `ui/.env` file:

```env
VITE_API_BASE_URL=http://your-idempiere-server:8080
VITE_APP_TITLE=iDempiere Resource UI
```

### API Endpoints

The application connects to iDempiere REST API:

- `/api/v1/models/C_Payment` - Payment management
- `/api/v1/models/R_Request` - Consultation requests
- `/api/v1/models/C_Order` - Order management
- `/api/v1/models/S_Resource` - Resource booking

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in docker-compose.yml
   ports:
     - "8889:5173"
   ```

2. **Permission denied**
   ```bash
   sudo chown -R $USER:$USER .
   ```

3. **Container won't start**
   ```bash
   # Clear Docker cache
   docker system prune -f
   docker-compose build --no-cache
   ```

## API Integration Notes

The application expects iDempiere to be running on the configured API endpoint. Make sure your iDempiere server is accessible and the REST API is enabled.

## Contributing

1. Make your changes in the `ui/` directory
2. Test with `docker-compose up`
3. Commit your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.