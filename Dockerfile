# Use official Node.js image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Set environment variables if needed
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Start the app
CMD ["node", "index.js"]
