# Frontend Deployment Guide

This frontend should be deployed separately from the backend to avoid routing conflicts.

## Deployment Options

### Option 1: Vercel (Recommended)

1. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Select the `frontend` folder as the root directory

2. **Configure Environment Variables:**
   - In Vercel dashboard, go to Settings > Environment Variables
   - Add: `VITE_API_URL` = `https://api.curat.ai`

3. **Deploy:**
   - Vercel will automatically build and deploy
   - Your frontend will be available at a Vercel URL
   - Configure custom domain `www.curat.ai` in Vercel settings

### Option 2: Netlify

1. **Connect to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Import your GitHub repository
   - Set build command: `bun run build`
   - Set publish directory: `dist`

2. **Configure Environment Variables:**
   - In Netlify dashboard, go to Site settings > Environment variables
   - Add: `VITE_API_URL` = `https://api.curat.ai`

3. **Deploy:**
   - Netlify will automatically build and deploy
   - Configure custom domain `www.curat.ai` in Netlify settings

### Option 3: GitHub Pages

1. **Enable GitHub Pages:**
   - Go to repository Settings > Pages
   - Select source: GitHub Actions

2. **Create GitHub Action:**
   - Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [ main ]
       paths: [ 'frontend/**' ]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
         - run: npm install -g bun
         - run: cd frontend && bun install && bun run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./frontend/dist
   ```

## Environment Configuration

The frontend is configured to use the correct API URL based on the deployment environment:

- **Development**: `http://localhost:4000`
- **Production**: `https://api.curat.ai`
- **Staging**: `https://api.curat.ai`

## Custom Domain Setup

After deploying, configure your custom domain:

1. **DNS Configuration:**
   - Add CNAME record: `www.curat.ai` → `your-deployment-url`
   - Or A record pointing to the deployment platform's IP

2. **SSL Certificate:**
   - Most platforms (Vercel, Netlify) provide automatic SSL
   - Ensure HTTPS is enabled

## Testing

After deployment:

1. **Test Frontend**: Visit your deployed frontend URL
2. **Test API Connection**: Verify the frontend can connect to `https://api.curat.ai`
3. **Test Login**: Try logging in to ensure full functionality

## Troubleshooting

- **CORS Issues**: Ensure `www.curat.ai` is in the backend's CORS allowed origins
- **API Connection**: Check that `https://api.curat.ai` is accessible
- **Build Errors**: Verify all dependencies are installed correctly
