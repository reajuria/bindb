# BinDB Deployment Guide

This guide covers deploying BinDB to various cloud platforms and container environments.

## 🚀 Google Cloud Run (Recommended)

### Prerequisites
- Google Cloud SDK installed and authenticated
- Docker installed
- Google Cloud project with billing enabled

### Quick Deployment

1. **Set your project ID:**
   ```bash
   export PROJECT_ID=your-project-id
   ```

2. **Deploy with one command:**
   ```bash
   npm run deploy:cloud-run
   ```

3. **Or use the deployment script:**
   ```bash
   ./deploy.sh
   ```

### Automated CI/CD with Cloud Build

1. **Enable required APIs:**
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   ```

2. **Deploy via Cloud Build:**
   ```bash
   npm run deploy:build
   ```

### Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PROJECT_ID` | `your-project-id` | Google Cloud project ID |
| `SERVICE_NAME` | `bindb` | Cloud Run service name |
| `REGION` | `us-central1` | Deployment region |

## 🐳 Docker Deployment

### Local Docker

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Or manually
docker build -t bindb .
docker run -p 8080:8080 bindb
```

### Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  bindb:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## ☁️ Other Cloud Platforms

### AWS ECS/Fargate

1. **Build and push to ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
   docker build -t bindb .
   docker tag bindb:latest your-account.dkr.ecr.us-east-1.amazonaws.com/bindb:latest
   docker push your-account.dkr.ecr.us-east-1.amazonaws.com/bindb:latest
   ```

2. **Deploy to ECS Fargate** (use AWS Console or CLI)

### Azure Container Instances

```bash
# Build and push to Azure Container Registry
az acr build --registry your-registry --image bindb .

# Deploy to Container Instances
az container create \
  --resource-group your-rg \
  --name bindb \
  --image your-registry.azurecr.io/bindb:latest \
  --ports 8080 \
  --dns-name-label bindb
```

### DigitalOcean App Platform

1. **Connect your repository**
2. **Select the Dockerfile**
3. **Configure environment variables**
4. **Deploy**

## 🔧 Environment Configuration

### Production Environment Variables

```bash
NODE_ENV=production
PORT=8080
```

### Custom Configuration

Create a `.env` file for local development:
```env
NODE_ENV=development
PORT=3000
```

## 📊 Monitoring & Health Checks

### Health Endpoint
- **URL**: `/v1/health`
- **Method**: GET
- **Response**: JSON with service status

### Example Health Check
```bash
curl https://your-service-url/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "0.0.1",
  "uptime": 123.45,
  "databases": {},
  "performance": {}
}
```

## 🔒 Security Considerations

### Cloud Run Security
- ✅ HTTPS enforced automatically
- ✅ Authentication available via IAM
- ✅ Container isolation
- ✅ Automatic security updates

### Docker Security
- ✅ Non-root user in container
- ✅ Minimal Alpine base image
- ✅ No sensitive data in image
- ✅ Health checks enabled

## 📈 Scaling Configuration

### Cloud Run Auto-scaling
- **Min instances**: 0 (cost optimization)
- **Max instances**: 10 (performance limit)
- **Concurrency**: 80 requests per instance
- **Memory**: 512Mi
- **CPU**: 1 vCPU

### Custom Scaling
Modify the deployment script or Cloud Build configuration to adjust:
- Memory allocation
- CPU allocation
- Instance limits
- Concurrency settings

## 🚨 Troubleshooting

### Common Issues

1. **Port binding errors:**
   - Ensure PORT environment variable is set
   - Check if port 8080 is available

2. **Memory issues:**
   - Increase memory allocation in deployment config
   - Monitor memory usage in logs

3. **Authentication errors:**
   - Verify gcloud authentication
   - Check project permissions

### Logs and Debugging

```bash
# Cloud Run logs
gcloud logs tail --service=bindb --region=us-central1

# Docker logs
docker logs bindb-container

# Local development logs
npm run dev
```

## 📚 Additional Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [BinDB API Documentation](./API.md)