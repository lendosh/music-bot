FROM node:20.13.1
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Expose the port that the application listens on.
EXPOSE 8080

# Run the application.
CMD ["npx", "ts-node", "src/app.ts"]
