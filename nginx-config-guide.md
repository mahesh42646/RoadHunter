# Nginx Configuration Guide for 100MB File Uploads

## Step 1: Connect to your VPS via SSH
```bash
ssh root@your-vps-ip
# or
ssh your-username@your-vps-ip
```

## Step 2: Find your nginx configuration file
```bash
# Check if nginx is installed
nginx -v

# Find nginx config file location
nginx -t

# Common locations:
# - /etc/nginx/nginx.conf (main config)
# - /etc/nginx/sites-available/default (default site)
# - /etc/nginx/sites-available/your-site-name (your site config)
# - /etc/nginx/conf.d/*.conf (additional configs)
```

## Step 3: Backup the current config (IMPORTANT!)
```bash
# Backup main config
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# If you have a site-specific config, backup that too
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
# or
sudo cp /etc/nginx/sites-available/your-site-name /etc/nginx/sites-available/your-site-name.backup
```

## Step 4: Edit nginx configuration

### Option A: Edit main nginx.conf (affects all sites)
```bash
sudo nano /etc/nginx/nginx.conf
```

Add or modify these settings in the `http` block:
```nginx
http {
    # ... existing settings ...
    
    # Increase client body size limit to 100MB
    client_max_body_size 100M;
    
    # Increase timeouts for large file uploads
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    
    # Increase buffer sizes
    client_body_buffer_size 128k;
    proxy_buffering off;
    
    # ... rest of config ...
}
```

### Option B: Edit site-specific config (recommended)
```bash
# Find your site config
ls -la /etc/nginx/sites-available/

# Edit your site config (replace 'default' with your actual site name)
sudo nano /etc/nginx/sites-available/default
# or
sudo nano /etc/nginx/sites-available/your-site-name
```

Add these settings in the `server` block for your API:
```nginx
server {
    listen 80;
    # or listen 443 ssl; for HTTPS
    
    server_name api.darkunde.in;  # Your domain
    
    # Increase client body size limit to 100MB
    client_max_body_size 100M;
    
    # Increase timeouts for large file uploads
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    
    # Increase buffer sizes
    client_body_buffer_size 128k;
    proxy_buffering off;
    
    # Proxy to your Node.js backend
    location / {
        proxy_pass http://localhost:5030;  # Your Node.js port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Additional settings for file uploads
        proxy_request_buffering off;
        proxy_buffering off;
    }
}
```

## Step 5: Test nginx configuration
```bash
# Test the configuration for syntax errors
sudo nginx -t
```

If you see "syntax is ok" and "test is successful", proceed to the next step.

## Step 6: Reload nginx (without downtime)
```bash
# Reload nginx configuration
sudo systemctl reload nginx

# OR if reload doesn't work, restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx
```

## Step 7: Verify the changes
```bash
# Check if nginx is running
sudo systemctl status nginx

# View nginx error logs if needed
sudo tail -f /var/log/nginx/error.log

# View nginx access logs
sudo tail -f /var/log/nginx/access.log
```

## Step 8: Test file upload
Try uploading a file through your admin panel. The 413 error should be resolved.

## Troubleshooting

### If nginx -t shows errors:
- Check the line numbers mentioned in the error
- Make sure all brackets `{}` are properly closed
- Make sure semicolons `;` are at the end of each directive

### If nginx won't start:
```bash
# Check error logs
sudo tail -50 /var/log/nginx/error.log

# Restore backup if needed
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
sudo systemctl restart nginx
```

### If you're using PM2 or another process manager:
Make sure your Node.js app is running:
```bash
pm2 list
pm2 logs
```

### Check if your Node.js app is listening on the correct port:
```bash
# Check if port 5030 is in use
sudo netstat -tulpn | grep 5030
# or
sudo ss -tulpn | grep 5030
```

## Quick Reference Commands

```bash
# Edit nginx config
sudo nano /etc/nginx/sites-available/default

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/error.log
```

## Important Notes

1. **Always backup** before making changes
2. **Test configuration** with `nginx -t` before reloading
3. **Use `reload`** instead of `restart` to avoid downtime
4. **Check logs** if something goes wrong
5. If you have **multiple sites**, configure each one separately or use the main `nginx.conf`

