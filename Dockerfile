# Use Node.js v18 base image
FROM node:18

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port your app uses
EXPOSE 3001

# Start the app
CMD ["node", "index.js"]
