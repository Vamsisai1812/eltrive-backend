# Use Node.js official image
FROM node:20

# Create app directory
WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN npm install

# Expose port (same as in index.js)
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]
